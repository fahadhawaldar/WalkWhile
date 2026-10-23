import { generateWalkingRoutes } from './services/routeGeneration.js';
import { calculateReturnRoute } from './services/returnRoute.js';

async function verify() {
  const origin = { latitude: 25.2048, longitude: 55.2708 }; // DIFC Gate, Dubai
  console.log('--- 1. Testing Route Generation for 10 min Budget (DIFC) ---');

  const genResult = await generateWalkingRoutes({
    origin,
    availableMinutes: 10,
    walkingSpeedKmh: 5,
    safetyBufferMinutes: 2.5,
    maxRoutes: 3,
    waitType: 'fixed',
    maxReturnMinutes: 3,
  });

  console.log('Result Count:', genResult.count);
  console.log('Walking Budget:', genResult.walkingBudgetMinutes, 'minutes');
  console.log('Target Distance:', genResult.targetDistanceMeters, 'meters');
  console.log('Warnings:', genResult.warnings);

  genResult.routes.forEach((route, idx) => {
    console.log(
      `Route #${idx + 1}: ${route.type.toUpperCase()} | Distance: ${
        route.distanceMeters
      }m | Calibrated: ${Math.round(
        route.calibratedDurationSeconds / 60
      )}m (${route.calibratedDurationSeconds}s) | Points: ${
        route.geometry.coordinates.length
      }`
    );
    console.log(`  First step: "${route.instructions[0]?.instruction}"`);
  });

  console.log('\n--- 2. Testing Return Route Calculation (Active Walk) ---');
  const returnResult = await calculateReturnRoute({
    originalOrigin: origin,
    currentLocation: { latitude: 25.2072, longitude: 55.2728 },
    remainingMinutes: 6,
    walkingSpeedKmh: 5,
    safetyBufferMinutes: 2.5,
  });

  console.log('Status:', returnResult.status);
  console.log('Recommended Action:', returnResult.recommendedAction);
  console.log('Safety Margin:', returnResult.safetyMarginSeconds, 'seconds');
  console.log('Message:', returnResult.message);
  console.log('Return Distance:', returnResult.route.distanceMeters, 'meters');

  console.log('\n✅ Verification Script Completed Successfully!');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
