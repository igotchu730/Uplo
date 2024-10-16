const uploadBox = document.getElementById('upload'); // The whole upload box.
const fileInput = document.getElementById('uploadFile'); // The file the user uploads.
const stagingBox = document.getElementById('staging'); // The staging box after users choose files.

// When the page is loaded...
document.addEventListener("DOMContentLoaded", function() {
    uploadBox.addEventListener("click", function() { // The upload box when clicked will open the file explorer.
        fileInput.click();
    });
    stagingBox.style.display = 'none'; // Hide the staging box
});

// After the user selects file(s), the upload box will disappear and the staging box will appear.
fileInput.addEventListener('change',(event) => {
    const files = event.target.files;

    if(files.length > 0){
        uploadBox.style.display = 'none';
        stagingBox.style.display = 'flex';
    }
})
