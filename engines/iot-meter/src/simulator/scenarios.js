/**
 * The six controllable scenarios from IOT_METER.md ("Simulator Controls").
 *
 * generationMultiplier / consumptionMultiplier scale the natural time-of-day
 * curve computed in MeterSimulator. SHORTFALL is different in kind: it
 * doesn't change the meter's own generation/consumption reading, it changes
 * what the meter *reports as delivered* against an already-committed trade
 * quantity (see MeterSimulator.getDeliveredKwh) — that's what feeds the
 * blockchain adapter's dispute path.
 */
const SCENARIOS = Object.freeze({
  NORMAL: {
    key: 'NORMAL',
    label: 'Normal solar day',
    generationMultiplier: 1.0,
    consumptionMultiplier: 1.0,
    shortfallPercent: 0,
  },
  HIGH_GENERATION: {
    key: 'HIGH_GENERATION',
    label: 'High generation',
    generationMultiplier: 1.6,
    consumptionMultiplier: 1.0,
    shortfallPercent: 0,
  },
  LOW_GENERATION: {
    key: 'LOW_GENERATION',
    label: 'Low generation (cloudy)',
    generationMultiplier: 0.4,
    consumptionMultiplier: 1.0,
    shortfallPercent: 0,
  },
  HIGH_DEMAND: {
    key: 'HIGH_DEMAND',
    label: 'High household demand',
    generationMultiplier: 1.0,
    consumptionMultiplier: 2.2,
    shortfallPercent: 0,
  },
  CONGESTION: {
    key: 'CONGESTION',
    label: 'Congestion scenario (zone-wide load spike)',
    generationMultiplier: 1.0,
    consumptionMultiplier: 2.5,
    shortfallPercent: 0,
    // This meter just reports a heavy load like every other meter in the
    // zone would; it's the (separately owned) congestion engine's job to
    // watch aggregate zone load and decide NORMAL/ELEVATED/CONSTRAINED.
  },
  DELIVERY_SHORTFALL: {
    key: 'DELIVERY_SHORTFALL',
    label: 'Delivery shortfall scenario',
    generationMultiplier: 1.0,
    consumptionMultiplier: 1.0,
    shortfallPercent: 0.2, // reports 20% less than committed when delivery is verified
  },
});

function getScenario(key) {
  const scenario = SCENARIOS[key];
  if (!scenario) {
    const valid = Object.keys(SCENARIOS).join(', ');
    throw new Error(`Unknown scenario '${key}'. Valid scenarios: ${valid}`);
  }
  return scenario;
}

module.exports = { SCENARIOS, getScenario };
