const bucketName = 'skut-bucket-1';
const {Storage} = require('@google-cloud/storage');

// Creates a client
const storage = new Storage({keyFilename: 'fluted-haven-351608-1b673a72d8fb.json' });

async function uploadCloud(filePath, destFileName) {
  await storage.bucket(bucketName).upload(filePath, {
    destination: destFileName,
  });

  console.log(`${filePath} uploaded to ${bucketName}`);
}

module.exports = uploadCloud

//uploadCloud('./images/271921066_4752481248204483_199258755958203920_n.png', 'test').catch(console.error);