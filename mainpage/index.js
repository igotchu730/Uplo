
document.addEventListener("DOMContentLoaded", function() {
    const plusSign= document.querySelector("#click");
    const fileInput = document.querySelector("#uploadFile");

    plusSign.addEventListener("click", function() {

        fileInput.click();
    });
});
