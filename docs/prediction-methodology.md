# US Market AI — Quantitative Prediction Methodology

## Model

Current baseline: `quant-v2.0`.

This is a deterministic quantitative model, not a claim that an AI model can know the future price. It converts stored market observations into a repeatable estimate and records the inputs used for each prediction.

## Inputs

### Technical signals — target weight 65%
- Price vs EMA 20
- Price vs EMA 50
- Price vs SMA 50
- Price vs SMA 200
- EMA 20/50 alignment
- RSI regime
- MACD histogram
- Momentum
- Position between stored support and resistance

### Fundamental signals — target weight 35%
- Revenue growth
- EPS growth
- ROE
- ROA
- Free-cash-flow margin when revenue and FCF are available
- Debt/equity
- P/E and PEG valuation context at low weights

Raw valuation multiples intentionally have lower influence because comparing them without sector normalization can be misleading.

## Forecast horizons

The engine generates 24-hour, 7-day, 30-day and 90-day estimates. The combined signal is scaled by observed volatility and horizon length, with explicit caps to prevent unrealistic jumps.

## Confidence

Confidence is a data-quality/agreement measure. It reflects how consistently the available factors point in the same direction and how much relevant data is available. It is not a probability that the forecast will be correct.

## Output

Every prediction stores:
- model version
- prediction timestamp
- horizon
- current price
- predicted price
- predicted percentage change
- direction
- confidence
- signal
- factor-level feature summary

## Validation

Predictions must be evaluated against later observed prices using `prediction_results`. Historical accuracy should be measured by horizon and model version before changing weights. No accuracy claim should be published until enough matured predictions exist.

## Important limitation

The baseline is sector-neutral and does not yet use sector-relative normalization, market-regime features, analyst consensus, filings text, or a trained machine-learning model. Those can be added as separate validated model versions rather than silently changing the meaning of existing predictions.
