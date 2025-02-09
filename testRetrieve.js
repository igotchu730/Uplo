const{
    retrieveFileUploadData,
} = require('./utility');

const id = '146eae12a92be116b4955de9ef3780eb';
const field = 'ip_hash';

const retrievedData = retrieveFileUploadData(id,field);
