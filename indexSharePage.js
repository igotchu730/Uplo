const copyButton = document.getElementById('copyButton');
const downloadBtn = document.getElementById('downloadBtn');
const toolTip = document.getElementById('toolTip');


//listens for download button click.
downloadBtn.addEventListener('click', function() {
    //get stored presigned url
    const url = this.getAttribute('data-url');
    console.log("Download URL:", url);
    if (!url) {
        console.error("Error: No download URL found.");
        return;
    }
    // redirects browser to given url
    window.location.href = url;
});

//listens for copy link button click.
copyButton.addEventListener('click', function() {
    //when clicked, change icon and tooltip
    document.getElementById('copyIcon').src = '/assets/copiedIcon.png'
    toolTip.textContent = 'Copied!';
    //after 3 seconds, revert back
    setTimeout(() => {
        document.getElementById('copyIcon').src = '/assets/copyIcon.png'
        toolTip.textContent = 'Copy Link';
    }, 3000);
});

//listens for mouse to hover over link button to display tool tip
copyButton.addEventListener('mouseenter', function(){
    toolTip.textContent = 'Copy Link';
    toolTip.style.display = 'block';
});
copyButton.addEventListener('mouseleave', function(){
    toolTip.style.display = 'none';
});


// function to copy link
function copyText(){
    let copyText = document.getElementById("copyLink"); //retrive container
    copyText.select(); //select all text inside element
    copyText.setSelectionRange(0, 99999); // for mobile devices, select all text
    document.execCommand("copy"); // execute copy command
};