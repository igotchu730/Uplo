require('aws-sdk/lib/maintenance_mode_message').suppress = true; //temp code to block maintenance message
const { checkIpCount } = require('./utility');

(async () => {
    const testIp = '192.168.1.1'; // test ip

    try {
        console.log(`Checking IP count: ${testIp}`);
        const result = await checkIpCount(testIp);
        console.log(`Result: ${result}`);
    } catch (error) {
        console.error('Error checking IP count:', error.message);
    }
})();
