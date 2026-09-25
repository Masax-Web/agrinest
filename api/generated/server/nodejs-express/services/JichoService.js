const { diagnoseImage } = require('../../../../services/JichoVisionService');

async function diagnose(data) {
  return diagnoseImage(data.image_base64);
}

module.exports = { diagnose };
