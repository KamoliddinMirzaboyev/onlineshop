"""DB talab qilmaydigan order xizmati unit testlari."""

import pytest
from fastapi import HTTPException

from app.models.enums import OrderStatus, PaymentMethod
from app.services.orders import (
    ALLOWED_PAYMENT_METHODS,
    DEFAULT_DELIVERY_PER_KM,
    calc_delivery_fee,
    ensure_transition,
)


def test_allowed_payments_only_cash():
    assert ALLOWED_PAYMENT_METHODS == {PaymentMethod.cash}


def test_transition_allows_pending_to_accepted():
    ensure_transition(OrderStatus.pending, OrderStatus.accepted)


def test_transition_blocks_delivered_to_pending():
    with pytest.raises(HTTPException) as ei:
        ensure_transition(OrderStatus.delivered, OrderStatus.pending)
    assert ei.value.status_code == 400


def test_transition_same_status_noop():
    ensure_transition(OrderStatus.pending, OrderStatus.pending)


def test_transition_cancel_from_delivering():
    ensure_transition(OrderStatus.delivering, OrderStatus.cancelled)


def test_calc_delivery_fee_defaults():
    assert calc_delivery_fee(10_000, 2.0, 0, 0) == 2 * DEFAULT_DELIVERY_PER_KM
