document.addEventListener("DOMContentLoaded", function() {
    const uploadBox = document.querySelector("#upload");
    const fileInput = document.querySelector("#uploadFile");

    uploadBox.addEventListener("click", function() {
        fileInput.click();
    });
});
