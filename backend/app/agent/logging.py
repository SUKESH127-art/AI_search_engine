"""Structured progress logging utilities."""
import logging
from typing import Optional


class AgentLogger:
    """Lightweight wrapper around Python logging for pipeline steps."""

    def __init__(self, context: Optional[str] = None):
        self._logger = logging.getLogger("agent")
        self._context = context

    def _compose_message(self, step: str, status: str, message: str = "") -> str:
        parts = [
            f"step={step}",
            f"status={status}",
        ]
        if self._context:
            parts.append(f"context={self._context}")
        if message:
            parts.append(f"message={message}")
        return " | ".join(parts)

    def emit(self, step: str, status: str, message: str = "") -> None:
        """Emit a structured log message."""
        self._logger.info(self._compose_message(step, status, message))

    def start(self, step: str) -> None:
        """Log the start of a step."""
        self.emit(step, "start")

    def end(self, step: str) -> None:
        """Log the end of a step."""
        self.emit(step, "end")

    def error(self, step: str, msg: str) -> None:
        """Log an error for a step."""
        self._logger.error(self._compose_message(step, "error", msg))

