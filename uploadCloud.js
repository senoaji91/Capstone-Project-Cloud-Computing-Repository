const bucketName = 'skut_recent_scan';
const {Storage} = require('@google-cloud/storage');

// Creates a client
const storage = new Storage({keyFilename: 'cryptic-skyline-350211-b09504b635a5.json' });

async function uploadCloud(filePath, destFileName) {
  await storage.bucket(bucketName).upload(filePath, {
    destination: destFileName,
  });

  console.log(`${filePath} uploaded to ${bucketName}`);
}

module.exports = uploadCloud

//uploadCloud('./images/271921066_4752481248204483_199258755958203920_n.png', 'test').catch(console.error);