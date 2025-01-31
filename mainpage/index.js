const uploadBox = document.getElementById('upload'); // The whole upload box.
const fileInput = document.getElementById('uploadFile'); // The file(s) the user uploads.
const stagingBox = document.getElementById('staging'); // The staging box after users choose files.
const addMoreButton = document.getElementById('addMoreButton'); // button to add moore files
const resetButton = document.getElementById('resetButton'); // button to reset file upload



//FOR TESTING: REMOVE LATER
const logFiles = () => {
    console.clear();
    for (let i = 0; i < fileInput.files.length; i++) {
        console.log(`File ${i + 1}:`, fileInput.files[i]);
    }
};

// When the page is loaded...
document.addEventListener("DOMContentLoaded", function() {
    stagingBox.style.display = 'none'; // Hide the staging box
    uploadBox.addEventListener("click", function() { // The upload box when clicked will open the file explorer.
        fileInput.click();
    });
    addMoreButton.addEventListener('click', function(){ // The addMoreButton when clicked will open the file explorer.
        fileInput.click();
    })
    resetButton.addEventListener('click', function(){ // The resetButton when clicked will clear all file inputs and return to upload box.
        fileInput.value = '';
        fileList = [];
        uploadBox.style.display = 'flex';
        stagingBox.style.display = 'none';
    })
});

// After the user selects file(s), the upload box will disappear and the staging box will appear.
fileInput.addEventListener('change',(event) => {
    const files = event.target.files;

    if(files.length > 0){
        uploadBox.style.display = 'none';
        stagingBox.style.display = 'flex';
    }
})



/* -- file preview display -- */

let fileList = []; //create manual array to track user files
let totalUploadSize; //global variable for size of upload, dynamic size
let totalUploadSizeGB; //global variable for size of upload ing GB

let fileListPrev = []; // copy array. Like a checkpoint for when the file upload size was last under 2 GB.    
let isRestoring = false; // flag

fileInput.addEventListener('change',function(){ //listen for changes in file input
    
    const filePreview = document.getElementById('filePreview');
    filePreview.innerHTML = ''; //clear display area

    // Create an array from the file input, For each file...
    Array.from(this.files).forEach(file => {
        // Ensure that files are not added twice
        if (!fileList.some(f => f.name === file.name && f.size === file.size)) { //no duplicates, return false
            fileList.push(file); //push the file into the fileList
            const dataTransfer = new DataTransfer();
            fileList.forEach(file => dataTransfer.items.add(file));
            fileInput.files = dataTransfer.files;
        }
    });
    
    // Check upload size limit
    // if file upload size is less than 2 GB
    if(totalFileSizeInBytes(fileList) < (2 * (1024 ** 3))){
        // Copy file list to a another array
        fileListPrev = [...fileList];
        // Log
        console.log('Upload size is within 2.00 GB limit.')
    } else{ // if file upload size is greater than 2 GB

        // Log and alert user
        console.log('Upload size is over 2.00 GB limit.');
        alert('Upload size is over 2.00 GB limit.');

        isRestoring = true; // Set flag to prevent infinite loop

        // set filelist to the last time it was under 2 GB
        fileList = [...fileListPrev];
        updateFileInput(); // update the file input (UI)
        
        // test logs
        console.log('fileListPrev',fileListPrev);
        console.log('fileList',fileList);

        isRestoring = false; // Reset flag
        
    };

    // for each file input...
    fileList.forEach((file, index) => {

        // Create a div for the file
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        // Create a span that contains the data name of the file
        const fileDataName = document.createElement('span');
        fileDataName.textContent = `${file.name}`;

        // Create a span that contains the data size of the file
        const fileDataSize = document.createElement('span');
        fileDataSize.textContent = `${formatFileSize(file.size)}`;

        const fileDataContainer = document.createElement('div');
        fileDataContainer.className = 'file-data-container';
        fileDataContainer.appendChild(fileDataName);
        fileDataContainer.appendChild(fileDataSize);

        // Create the delete button and add the image icon
        const deleteButton = document.createElement('button')
        deleteButton.className = 'delete-button';
        const img = document.createElement('img');
        img.src = '/assets/trashIcon.png';
        img.className = 'delete-button-img';
        deleteButton.appendChild(img);

        // event listener for delete button click
        deleteButton.addEventListener('click', function(){
            removeFile(index);
        });

        // Append file data and deleteButton to the fileItem div
        fileItem.appendChild(fileDataContainer);
        fileItem.appendChild(deleteButton);

        // Append fileItem div to the file preview display area
        filePreview.appendChild(fileItem);

    })
    
    // update the upload sizes and display it
    totalUploadSize = totalFileSize(fileList)
    totalUploadSizeGB = totalFileSizeInGB(fileList)
    const uploadSize = document.getElementById('fileSize');
    uploadSize.textContent = `${totalFileSize(fileList)} / 2 GB`;

    //FOR TESTING: REMOVE LATER
    //logFiles();
    console.log(totalUploadSize);
    console.log(totalUploadSizeGB + ' GB');
    console.log(`Bytes: ${totalFileSizeInBytes(fileList)}`);
    //FOR TESTING: REMOVE LATER
})

// function to remove a file from the manual file list at a given index
function removeFile(index){
    fileList.splice(index,1); // at the given index, remove element
    updateFileInput(); // update the file list array
}

// function to update the file list
function updateFileInput(){

    if (isRestoring) return; // Prevent infinite loop during restoration

    // create a new dataTransfer object to allow manipulation of file input list
    const dataTransfer = new DataTransfer();

    // add all remaining fileList elements to dataTransfer object
    fileList.forEach(file => dataTransfer.items.add(file));

    // replace the current file input list with the new updated dataTransfer object
    fileInput.files = dataTransfer.files; 

    // trigger the 'change' event to refresh the display
    fileInput.dispatchEvent(new Event('change'));
}

// function to format the file size to readable sizes
function formatFileSize(bytes){
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']; // array of file sizes
    if(bytes === 0) return '0 B'; // if size is 0, return 0
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)),10);
    // get ln of bytes divided by ln of 1024. This will determine the position in the array and therefore the size type.
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// finds sum of all file sizes given an array of files, returns total size dynamically
function totalFileSize(files){
    let totalSize = 0;
    files.forEach(file => {
        totalSize += file.size;
    });
    totalSize = formatFileSize(totalSize);
    return totalSize;
};

// finds sum of all file sizes given an array of files, returns total size in bytes
function totalFileSizeInBytes(files){
    let totalSize = 0;
    files.forEach(file => {
        totalSize += file.size;
    });
    return totalSize;
};

// function to format the file size to GB
function formatFileSizeInGB(bytes) {
    const sizeInGB = bytes / Math.pow(1024, 3); // Convert bytes to GB
    return sizeInGB.toFixed(9); // Format to 9 decimal places
}

// finds sum of all file sizes given an array of files, returns total size in GB
function totalFileSizeInGB(files){
    let totalSize = 0;
    files.forEach(file => {
        totalSize += file.size;
    });
    totalSize = formatFileSizeInGB(totalSize);
    return totalSize;
};
