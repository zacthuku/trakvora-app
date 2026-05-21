import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.notification_service import broadcast_location, register_tracking_connection, unregister_tracking_connection

router = APIRouter(tags=["tracking"])


@router.websocket("/tracking/{shipment_id}")
async def tracking_socket(shipment_id: str, websocket: WebSocket):
    await websocket.accept()
    register_tracking_connection(shipment_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                payload["shipment_id"] = shipment_id
                await broadcast_location(shipment_id, payload)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        unregister_tracking_connection(shipment_id, websocket)
