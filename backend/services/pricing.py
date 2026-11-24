import config


def recommend_price(occupancy: float, base_price: float, min_price: float, max_price: float) -> dict:
    """Return {"price", "kind", "reason"} for a predicted occupancy between 0 and 1.

    - occupancy >= 85 %  -> the price rises in proportion to demand, capped at max_price
    - occupancy <= 35 %  -> automatic 20 % promotion, never below min_price
    - otherwise          -> base price
    """
    occupancy = max(0.0, min(1.0, occupancy))

    if occupancy >= config.HIGH_OCCUPANCY:
        price = base_price * occupancy / config.REFERENCE_OCCUPANCY
        price = min(price, max_price)
        return {"price": round(price), "kind": "increase",
                "reason": "Forte demande prévue : hausse du prix"}

    if occupancy <= config.LOW_OCCUPANCY:
        price = base_price * (1 - config.PROMOTION_RATE)
        price = max(price, min_price)
        return {"price": round(price), "kind": "promotion",
                "reason": "Heures creuses : promotion de 20 %"}

    return {"price": round(base_price), "kind": "base",
            "reason": "Demande normale : prix de base"}
