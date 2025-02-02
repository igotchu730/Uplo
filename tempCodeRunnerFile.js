require('aws-sdk/lib/maintenance_mode_message').suppress = true; //temp code to block maintenance message
const {deleteFileUpload} = require('./utility.js');


(async () => {
    const testId = 'dab6bf67f15691b93aa8f1cee1125bc2'; // Change this ID to a valid one in your database

    try {
        console.log(`Attempting to delete file upload with id ${testId}...`);
        const result = await deleteFileUpload(testId);
        console.log('Result:', result);
    } catch (error) {
        console.error('Error during deletion:', error.message);
    }
})();