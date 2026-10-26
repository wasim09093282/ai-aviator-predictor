const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function determineRiskLabel(score) {
  if (score >= 75) return 'High Risk';
  if (score >= 45) return 'Moderate Risk';
  if (score >= 25) return 'Watch List';
  return 'Low Risk';
}

function determineRouteAdvice(score) {
  if (score >= 75) {
    return 'Re-route or defer launch. Weather and traffic conditions exceed the preferred operating envelope.';
  }
  if (score >= 45) {
    return 'Proceed with caution. Use contingency fuel, monitor ATC updates, and prepare for alternate routing.';
  }
  if (score >= 25) {
    return 'Operationally acceptable with monitoring. Keep a flexible plan and review the next two forecast windows.';
  }
  return 'Excellent window for dispatch. Proceed with normal procedures and standard monitoring.';
}

function buildPrediction(data) {
  const weatherImpact = {
    clear: 8,
    variable: 14,
    rain: 19,
    thunderstorm: 31,
    icing: 27
  };

  const takeoffWindow = {
    dawn: 6,
    morning: 9,
    afternoon: 11,
    evening: 16,
    night: 22
  };

  const windImpact = {
    calm: 5,
    moderate: 11,
    gusty: 17,
    strong: 24
  };

  const turbulenceImpact = {
    low: 7,
    moderate: 15,
    high: 25
  };

  const aircraftProfile = {
    narrowbody: 5,
    widebody: 8,
    turboprop: 13,
    light: 17
  };

  const weatherScore = weatherImpact[data.weather] || 12;
  const timeScore = takeoffWindow[data.timeOfDay] || 10;
  const windScore = windImpact[data.wind] || 10;
  const turbulenceScore = turbulenceImpact[data.turbulence] || 12;
  const aircraftScore = aircraftProfile[data.aircraft] || 10;
  const altitude = Number(data.altitude || 35000);
  const congestion = Number(data.congestion || 35);
  const visibility = Number(data.visibility || 8);

  let score =
    weatherScore +
    timeScore +
    windScore +
    turbulenceScore +
    aircraftScore +
    congestion * 0.22 +
    (visibility < 6 ? 12 : 0) +
    (altitude < 20000 ? 5 : 0);

  score = clamp(Math.round(score), 0, 100);

  const runway = data.runway || 'RWY 27';
  const departure = data.departure || 'KJFK';
  const destination = data.destination || 'KDFW';

  return {
    score,
    label: determineRiskLabel(score),
    summary: `${departure} to ${destination} shows a ${determineRiskLabel(score).toLowerCase()} profile for the stated window.`,
    routeAdvice: determineRouteAdvice(score),
    recommendedAction: score >= 60 ? 'Hold for weather review and file a diversion plan.' : score >= 35 ? 'Monitor conditions, keep alternate routing available.' : 'Proceed with normal dispatch review.',
    metrics: {
      runway,
      weather: data.weather || 'variable',
      wind: data.wind || 'moderate',
      turbulence: data.turbulence || 'moderate',
      departure,
      destination,
      confidence: clamp(100 - score / 1.5, 40, 95),
      eta: `${Math.max(1, Math.round((score / 100) * 5 + 1))}h 20m`
    }
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'AI Aviator Predictor' });
});

app.post('/api/predict', (req, res) => {
  const payload = req.body || {};
  const prediction = buildPrediction(payload);
  res.json(prediction);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`AI Aviator Predictor running at http://localhost:${port}`);
});
