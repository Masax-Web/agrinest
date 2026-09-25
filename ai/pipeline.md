AI Pipeline — Jicho & related models

Overview
The ML pipeline supports remote vision inference, device inference (TFLite), cloud retraining, and an active learning loop with human-in-the-loop verification.

Components
- Inference: `api/services/JichoVisionService.js` sends image bytes to the configured Hugging Face image-classification model (`HF_VISION_MODEL`)
- Offline inference: TFLite models can be embedded in a mobile app when a trained artifact is provided
- Ingestion: cloud endpoint collects labelled images and farmer feedback
- Active learning: low-confidence or farmer-disagreed cases flagged into reviewer queue
- Retraining: weekly batch jobs produce versioned model artifacts and evaluation metrics

Runtime requirements
- Set `HF_API_KEY` in the API environment; Jicho returns an explicit configuration error when it is missing
- Set `HF_VISION_MODEL` to a compatible image-classification model; the default is `linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification`
- No trained model weights are currently checked into this repository

Data storage
- Store images in object storage (`ai/datasets/jicho/`) with metadata (label, farmer_id, gps, timestamp, verifier_id)

Monitoring
- Track accuracy per crop and per region; alert if accuracy drops >5% after a retrain
