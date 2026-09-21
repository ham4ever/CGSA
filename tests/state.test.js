// Basic test to verify isNietSteriel and helper functions
(function() {
  console.log('Running CGSA State & Helper Tests...');

  if (typeof isNietSteriel !== 'function') {
    throw new Error('FAIL: isNietSteriel function is missing');
  }

  // Test isNietSteriel logic
  if (!isNietSteriel('Niet steriel')) {
    throw new Error('FAIL: " Niet steriel\ should be identified as non-sterile');
 }
 if (!isNietSteriel('Niets steriel (Maarten)')) {
 throw new Error('FAIL: \Niets steriel\ should be identified as non-sterile');
 }
 if (isNietSteriel('Alles steriel met sticker')) {
 throw new Error('FAIL: \Alles steriel met sticker\ should NOT be identified as non-sterile');
 }

 console.log('PASS: Helper tests passed successfully.');
})();
