const{
    retrieveFileUploadData,
    decryptData
} = require('./utility');

const id = '7d403af33ddd8555eb524a2beb3f7c3b.mp4';
const field = 'file_name';

(async () => {
    try {
        const result = await retrieveFileUploadData(id, field);
        const result2 = decryptData(result);
        console.log(result2);
    } catch (err) {
        console.error('Error retrieving file data:', err);
    }
})();