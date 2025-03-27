const{
    retrieveFileUploadData,
    decryptData
} = require('./utility');

const id = '8dcfae0ae0a22ef3ad9d7a69e3146624';
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