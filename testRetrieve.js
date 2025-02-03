const{
    retrieveFileUploadData,
} = require('./utility');

const id = '6ec427da0b062c38c464e689d48ce38c'
const field = 'file_size'

const retrievedData = retrieveFileUploadData(id, field);
