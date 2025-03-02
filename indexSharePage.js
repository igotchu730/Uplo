const copyButton = document.getElementById('copyButton');
const downloadBtn = document.getElementById('downloadBtn');
const toolTip = document.getElementById('toolTip');
const video = document.getElementById('video');
const videoPlayer = document.getElementById('videoPlayer');
const videoPausePlay = document.getElementById('videoPausePlay');
const audioBG = document.getElementById('audioBG');
const audioControl = document.getElementById('audioControl');
const audioPausePlay = document.getElementById('audioPausePlay');
const audioScreen = document.getElementById('audioScreen');
const image = document.getElementById('image');
const imageScreen = document.getElementById('imageScreen');
const pdf = document.getElementById('pdf');
const text = document.getElementById('text');
const office = document.getElementById('office');
const zip = document.getElementById('zip');
const zipLabel = document.getElementById('zipLabel');
const unknown = document.getElementById('unknown');




// when document is loaded, setup the correct element
document.addEventListener("DOMContentLoaded", () => {
    if(video){
        setupVideoControls();
    }
    else if(audio){
        setupAudioControls();
    }
    else if(image){
        setupImageControls();
    }
    else if(pdf){
        setupPDFControls();
    }
    else if(text){
        setupTXTControls();
    }
    else if(office){
        setupOfficeControls();
    }
    else if(zip){
        setupZipControls();
    }
    else if(zip){
        setupUnknownControls();
    }
});



/*
-----DOWNLOAD BUTTON-----
*/
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




/*
-----COPY BUTTON-----
*/
//listens for copy link button click.
copyButton.addEventListener('click', function(event) {
    //when clicked, change icon and tooltip
    document.getElementById('copyIcon').src = '/assets/copiedIcon.png'
    toolTip.textContent = 'Copied!';
    toolTip.style.right = (185) + "px";
    //after 3 seconds, revert back
    setTimeout(() => {
        document.getElementById('copyIcon').src = '/assets/copyIcon.png'
        toolTip.textContent = 'Copy Link';
        toolTip.style.right = (170) + "px";
    }, 3000);
});
//listens for mouse to hover over link button to display tool tip
copyButton.addEventListener('mouseenter', function(){
    toolTip.textContent = 'Copy Link';
    toolTip.style.display = 'block';
});
copyButton.addEventListener('mouseleave', function(){
    toolTip.style.display = 'none';
    toolTip.textContent = 'Copy Link';
    toolTip.style.right = (170) + "px";
});
// function to copy link
function copyText(){
    let copyText = document.getElementById("copyLink"); //retrive container
    copyText.select(); //select all text inside element
    copyText.setSelectionRange(0, 99999); // for mobile devices, select all text
    document.execCommand("copy"); // execute copy command
};




/*
-----VIDEO-----
*/
function setupVideoControls() {
    // function for playing and pausing, and changing the button dynamically
    function togglePlayPause() {
        if (videoPlayer.paused) {
            videoPlayer.play();
            videoPausePlay.src = '/assets/pauseIcon.png';
            videoPausePlay.style.opacity = '0';
        } else {
            videoPlayer.pause();
            videoPausePlay.src = '/assets/playIcon.png';
            videoPausePlay.style.opacity = '1';
        }
    }

    // when pause/play button is clicked, trigger change
    videoPausePlay.addEventListener('click',togglePlayPause);
    // when audio is playing or paused, change the button accordingly
    videoPlayer.addEventListener('play',function(){
        videoPausePlay.src = '/assets/pauseIcon.png';
    });
    videoPlayer.addEventListener('pause',function(){
        videoPausePlay.src = '/assets/playIcon.png';
    });

    // when cursor is on screen, show button. if not, dont show.
    const videoElements = [video]
    videoElements.forEach(element => {
        element.addEventListener('mouseenter', function(){
            videoPausePlay.style.opacity = '1';
        });
        element.addEventListener('mouseleave', function(){
            if (!videoPlayer.paused) {
                videoPausePlay.style.opacity = '0';
            }
        });
    });

    /* function to clear time out functions for video screen.
    After 3 seconds, hide screen affects and cursor */
    let timeoutVideo;
    function startHideTimeoutVideo(){
        clearTimeout(timeoutVideo);
        timeoutVideo = setTimeout(() => {
            if(!videoPlayer.paused){
                videoPausePlay.style.opacity = '0';
                videoPlayer.classList.add('hideMouse');
            }
        }, 2500);
    };

    // if cursor is moving, reset timer, show cursor and button, set timer again
    video.addEventListener('mousemove', () => {
        clearTimeout(timeoutVideo);
        videoPlayer.classList.remove('hideMouse');
        videoPausePlay.style.opacity = '1';
        startHideTimeoutVideo();
    });
     // if cursor off video, reset timer, reset class.
    video.addEventListener('mouseleave', () => {
        clearTimeout(timeoutVideo);
        videoPlayer.classList.remove('hideMouse');
    });
};

  


/*
-----AUDIO-----
*/
function setupAudioControls() {
    // initial screen
    audioPausePlay.style.opacity = '1'
    audioPausePlay.style.visibility = 'visible'
    audioBG.style.filter = 'brightness(50%) contrast(90%) blur(3px)';

    // Show button and blur on screen when cursor moves on it.
    // When the cursor is idle on the audio screen, hide it.
    // Keep showing blur and button if paused
    let timeoutAudio;
    audioScreen.addEventListener('mouseenter', function(){
        startHideTimeoutAudio();
    });
    audioScreen.addEventListener('mousemove', function(){
        clearTimeout(timeoutAudio);
        audioScreen.classList.remove('hideMouse');
        audioBG.style.filter = 'brightness(50%) contrast(90%) blur(3px)';
        audioPausePlay.style.opacity = '1';
        startHideTimeoutAudio();
    });
    audioScreen.addEventListener('mouseleave', function(){
        clearTimeout(timeoutAudio);
        // if not paused
        if(!audioControl.paused){
            audioScreen.classList.remove('hideMouse');
            audioBG.style.filter = 'none';
            audioPausePlay.style.opacity = '0';
        }
    });
    audioControl.addEventListener('mouseenter', function(){
        startHideTimeoutAudio();
    });
    audioControl.addEventListener('mousemove', function(){
        clearTimeout(timeoutAudio);
        audioScreen.classList.remove('hideMouse');
        audioBG.style.filter = 'brightness(50%) contrast(90%) blur(3px)';
        audioPausePlay.style.opacity = '1';
        startHideTimeoutAudio();
    });
    audioControl.addEventListener('mouseleave', function(){
        clearTimeout(timeoutAudio);
        // if not paused
        if(!audioControl.paused){
            audioScreen.classList.remove('hideMouse');
            audioBG.style.filter = 'none';
            audioPausePlay.style.opacity = '0';
        }
    });


    // when audio is playing or paused, change the button accordingly
    audioControl.addEventListener('play',function(){
        audioPausePlay.src = '/assets/pauseIcon.png';
    });
    audioControl.addEventListener('pause',function(){
        audioPausePlay.src = '/assets/playIcon.png';
    });

    //listens for audio screen click for pausing and playing
    const audioElements = [audioBG,audioPausePlay];
    audioElements.forEach(element => {
        element.addEventListener('click', function(){
            if(audioControl.paused){
                audioControl.play();
            }else{
                audioControl.pause();
            }
        });
    });

    /* function to clear time out functions for audio screen.
    After 3 seconds, hide screen affects and cursor */
    function startHideTimeoutAudio(){
        clearTimeout(timeoutAudio);
        timeoutAudio = setTimeout(() => {
            // if not paused
            if(!audioControl.paused){
                audioScreen.classList.add('hideMouse');
                audioBG.style.filter = 'none';
                audioPausePlay.style.opacity = '0';
            }
        }, 3000);
    };
};




/*
-----IMAGES-----
*/
function setupImageControls() {

};

/*
-----PDF-----
*/
function setupPDFControls() {

};

/*
-----TEXT-----
*/
function setupTXTControls() {

};

/*
-----OFFICE-----
*/
function setupOfficeControls() {

};
/*
-----ZIP-----
*/
function setupZipControls() {

};
/*
-----UNKNOWN-----
*/
function setupUnknownControls() {

};