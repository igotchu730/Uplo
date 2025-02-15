const{
    retrieveFileUploadData,
} = require('./utility');

const id = 'fffca26cb87567beaa40802c193d8507';
const field = 'expiration_date';

(async () => {
    try {
        const result = await retrieveFileUploadData(id, field);
        console.log(result);
    } catch (err) {
        console.error('Error retrieving file data:', err);
    }
})();