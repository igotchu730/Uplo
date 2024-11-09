const crypto = require('crypto');

// Function to create a randomized key for secure presigned urls
const randomKey = () => {
    const rawBytes = crypto.randomBytes(16);
    return rawBytes.toString('hex');
}


// export objects and functions
module.exports = {
    randomKey
};