from __future__ import annotations

import json
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    WebSocket,
    WebSocketDisconnect,
    Query,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_session_factory
from app.core.security import get_current_user, decode_token
from app.models.user import User
from app.models.conversation import Conversation, Message
from app.models.repository import Repository
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    ConversationWithMessages,
    MessageCreate,
    MessageResponse,
)
from app.agents.orchestrator import orchestrator

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    conv_in: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new chat conversation."""
    if conv_in.repo_id:
        # Verify repository exists and belongs to current user
        stmt = select(Repository).where(
            Repository.id == conv_in.repo_id, Repository.owner_id == current_user.id
        )
        res = await db.execute(stmt)
        if not res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found or does not belong to you.",
            )

    conv = Conversation(
        user_id=current_user.id,
        repo_id=conv_in.repo_id,
        title=conv_in.title,
        is_archived=False,
        message_count=0,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active conversations for the current user."""
    stmt = select(Conversation).where(
        Conversation.user_id == current_user.id, Conversation.is_archived == False
    ).order_by(Conversation.updated_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get conversation details along with its chat message history."""
    stmt = select(Conversation).where(
        Conversation.id == conversation_id, Conversation.user_id == current_user.id
    )
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return conv


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve message history for a specific conversation."""
    stmt = select(Conversation).where(
        Conversation.id == conversation_id, Conversation.user_id == current_user.id
    )
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    stmt_msgs = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
    res_msgs = await db.execute(stmt_msgs)
    return res_msgs.scalars().all()


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archive a conversation instead of physical deletion."""
    stmt = select(Conversation).where(
        Conversation.id == conversation_id, Conversation.user_id == current_user.id
    )
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    conv.is_archived = True
    await db.commit()
    return None


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: uuid.UUID,
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to a conversation (REST fallback option)."""
    stmt = select(Conversation).where(
        Conversation.id == conversation_id, Conversation.user_id == current_user.id
    )
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # 1. Create and save user message
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=msg_in.content,
        agent_type=msg_in.agent_type,
    )
    db.add(user_msg)
    conv.message_count += 1
    conv.updated_at = datetime.now(timezone.utc)
    await db.flush()

    # 2. Extract conversation history for orchestrator
    hist_stmt = select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.asc())
    hist_res = await db.execute(hist_stmt)
    history_messages = hist_res.scalars().all()
    history_list = [{"role": m.role, "content": m.content} for m in history_messages[:-1]]

    # 3. Call Orchestrator
    try:
        state = {
            "messages": [msg_in.content],
            "repo_id": str(conv.repo_id) if conv.repo_id else None,
            "user_id": str(current_user.id),
            "intent": msg_in.agent_type,
            "agent_result": None,
            "context": None,
            "sources": [],
            "conversation_history": history_list,
        }
        res_state = await orchestrator.run(state)
        agent_result = res_state.get("agent_result") or {}
        answer = res_state.get("messages")[-1].content
        sources = res_state.get("sources", [])
    except Exception as e:
        logger.error("Error in orchestrator run: %s", e)
        answer = "I encountered an error while processing your request. Please try again."
        sources = []

    # 4. Save assistant response
    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=answer,
        agent_type=msg_in.agent_type,
        sources=sources,
    )
    db.add(assistant_msg)
    conv.message_count += 1
    await db.commit()
    await db.refresh(assistant_msg)

    return assistant_msg


# ---------------------------------------------------------------------------
# WebSocket Endpoint
# ---------------------------------------------------------------------------


@router.websocket("/ws/chat/{conversation_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    conversation_id: uuid.UUID,
    token: Optional[str] = Query(None),
):
    """Real-time streaming agent chat WebSocket interface."""
    await websocket.accept()

    # 1. Authenticate user
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing auth token")
        return

    try:
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise ValueError("Token sub missing")
        user_id = uuid.UUID(user_id_str)
    except Exception as e:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=f"Invalid token: {e}")
        return

    session_factory = get_session_factory()

    async with session_factory() as db:
        # Verify conversation belongs to user
        stmt = select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user_id
        )
        res = await db.execute(stmt)
        conv = res.scalar_one_or_none()
        if not conv:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Conversation not found")
            return

    try:
        while True:
            # 2. Listen for incoming WebSocket messages
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                content = payload.get("content", "").strip()
                agent_type = payload.get("agent_type")  # optional override
            except Exception:
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON format"}))
                continue

            if not content:
                continue

            async with session_factory() as db:
                # Refresh conv state
                stmt = select(Conversation).where(Conversation.id == conversation_id)
                res = await db.execute(stmt)
                conv = res.scalar_one_or_none()

                # Save user message
                user_msg = Message(
                    conversation_id=conversation_id,
                    role="user",
                    content=content,
                    agent_type=agent_type,
                )
                db.add(user_msg)
                conv.message_count += 1
                conv.updated_at = datetime.now(timezone.utc)
                await db.commit()

                # Fetch all previous history
                hist_stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
                hist_res = await db.execute(hist_stmt)
                history_messages = hist_res.scalars().all()
                history_list = [{"role": m.role, "content": m.content} for m in history_messages]

            # Notify UI that agent started thinking
            await websocket.send_text(json.dumps({
                "type": "start",
                "agent_type": agent_type or "Orchestrator",
            }))

            # 3. Stream agent output
            full_response = ""
            sources = []
            try:
                state = {
                    "messages": [content],
                    "repo_id": str(conv.repo_id) if conv.repo_id else None,
                    "user_id": str(user_id),
                    "intent": agent_type,
                    "agent_result": None,
                    "context": None,
                    "sources": [],
                    "conversation_history": history_list[:-1],
                }

                import asyncio
                # Execute agent pipeline exactly once
                res_state = await orchestrator.run(state)
                sources = res_state.get("sources", [])

                # Retrieve compiled answer
                messages_list = res_state.get("messages", [])
                if messages_list:
                    last_msg = messages_list[-1]
                    answer = last_msg.content if hasattr(last_msg, "content") else str(last_msg)
                else:
                    answer = "I encountered an error while processing your request."

                # Stream compiled answer chunk-by-chunk for UI
                words = answer.split(" ")
                for i, word in enumerate(words):
                    chunk = word + (" " if i < len(words) - 1 else "")
                    full_response += chunk
                    await websocket.send_text(json.dumps({
                        "type": "chunk",
                        "content": chunk,
                    }))
                    await asyncio.sleep(0.005)
            except Exception as e:
                logger.error("Error in streaming response: %s", e)
                error_msg = f"\n\n[Error occurred: {str(e)}]"
                full_response += error_msg
                await websocket.send_text(json.dumps({
                    "type": "chunk",
                    "content": error_msg,
                }))

            # 4. Save assistant response to DB
            async with session_factory() as db:
                stmt = select(Conversation).where(Conversation.id == conversation_id)
                res = await db.execute(stmt)
                conv = res.scalar_one_or_none()

                assistant_msg = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=full_response,
                    agent_type=agent_type,
                    sources=sources,
                )
                db.add(assistant_msg)
                conv.message_count += 1
                await db.commit()
                await db.refresh(assistant_msg)

                msg_id = str(assistant_msg.id)

            # Send complete response message info to client
            await websocket.send_text(json.dumps({
                "type": "done",
                "message_id": msg_id,
                "sources": sources,
            }))

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for conversation: %s", conversation_id)
    except Exception as e:
        logger.error("Websocket error: %s", e)
