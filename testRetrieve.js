const{
    retrieveFileUploadData,
    decryptData
} = require('./utility');

const id = '55e91354f62885b1522431939f088637.jpg';
const field = 's3_link';

(async () => {
    try {
        const result = await retrieveFileUploadData(id, field);
        const result2 = decryptData(result);
        console.log(result2);
    } catch (err) {
        console.error('Error retrieving file data:', err);
    }
})();