require('aws-sdk/lib/maintenance_mode_message').suppress = true; //temp code to block maintenance message
const {deleteFileUpload} = require('./utility.js');


(async () => {
    const testId = '20b9640f583b25b995f6afee07c54806'; // Change this ID to a valid one in your database

    try {
        console.log(`Attempting to delete file upload with id ${testId}...`);
        const result = await deleteFileUpload(testId);
    } catch (error) {
        console.error('Error during deletion:', error.message);
    }
})();