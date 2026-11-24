from services.pricing import recommend_price

BASE, MIN, MAX = 100, 60, 150


def test_proposal_case_90_percent_gets_a_higher_capped_price():
    result = recommend_price(0.90, BASE, MIN, MAX)
    assert result["kind"] == "increase"
    assert BASE < result["price"] <= MAX
    assert result["price"] == 120
    assert result["reason"] == "Forte demande prévue : hausse du prix"
    assert recommend_price(0.90, BASE, MIN, 110)["price"] == 110


def test_proposal_case_25_percent_gets_a_20_percent_promotion():
    result = recommend_price(0.25, BASE, MIN, MAX)
    assert result["kind"] == "promotion"
    assert result["price"] == 80
    assert result["reason"] == "Heures creuses : promotion de 20 %"


def test_promotion_never_goes_below_the_minimum():
    assert recommend_price(0.10, BASE, 90, MAX)["price"] == 90


def test_normal_demand_keeps_the_base_price():
    for occupancy in (0.36, 0.50, 0.84):
        result = recommend_price(occupancy, BASE, MIN, MAX)
        assert (result["kind"], result["price"]) == ("base", BASE)


def test_thresholds_are_inclusive():
    assert recommend_price(0.85, BASE, MIN, MAX)["kind"] == "increase"
    assert recommend_price(0.35, BASE, MIN, MAX)["kind"] == "promotion"


def test_price_rises_in_proportion_to_demand():
    prices = [recommend_price(o, BASE, MIN, 1000)["price"] for o in (0.85, 0.90, 0.95, 1.0)]
    assert prices == sorted(prices) and len(set(prices)) == 4
    assert prices[-1] == 133


def test_out_of_range_occupancy_is_clipped():
    assert recommend_price(1.7, BASE, MIN, MAX)["price"] == 133
    assert recommend_price(-0.2, BASE, MIN, MAX)["kind"] == "promotion"
