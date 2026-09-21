// Basic test to verify routeData and weekSchedules integrity
(function() {
  console.log('Running CGSA Data Tests...');

  if (typeof weekSchedules === 'undefined') {
    throw new Error('FAIL: weekSchedules is undefined');
  }
  if (!Array.isArray(weekSchedules) || weekSchedules.length === 0) {
    throw new Error('FAIL: weekSchedules must be a non-empty array');
  }

  if (typeof routeData === 'undefined') {
    throw new Error('FAIL: routeData is undefined');
  }

  // Ensure each schedule points to existing routes
  weekSchedules.forEach(schedule => {
    schedule.routes.forEach(routeId => {
      if (!routeData[routeId]) {
        throw new Error('FAIL: Schedule ' + schedule.id + ' references missing route ' + routeId);
      }
    });
  });

  // Ensure allRooms array is generated and non-empty
  if (!Array.isArray(allRooms) || allRooms.length === 0) {
    throw new Error('FAIL: allRooms is empty or not an array');
  }

  console.log('PASS: Data integrity confirmed with ' + allRooms.length + ' total rooms across ' + weekSchedules.length + ' schedules.');
})();
