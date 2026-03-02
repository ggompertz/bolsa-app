"""
Envío de mensajes a Telegram via Bot API usando httpx.
"""
import logging
import httpx
from config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


async def send_message(chat_id: str, text: str) -> bool:
    """
    Envía un mensaje de texto a un chat de Telegram.
    Retorna True si fue exitoso, False si falló o no hay token configurado.
    """
    token = settings.telegram_bot_token
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN no configurado — notificación omitida")
        return False

    url = TELEGRAM_API.format(token=token)
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                return True
            logger.error("Telegram API error %s: %s", resp.status_code, resp.text)
            return False
    except Exception as exc:
        logger.error("Error enviando mensaje Telegram: %s", exc)
        return False
