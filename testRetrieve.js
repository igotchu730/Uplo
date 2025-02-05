const{
    retrieveFileUploadData,
} = require('./utility');

const id = '6b4a1c9602572a4872adeec42fe711c0';
const field = 'file_name';

const retrievedData = retrieveFileUploadData(id,field);
