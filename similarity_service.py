from fastapi import FastAPI
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import torch
import numpy as np
from pydantic import BaseModel
from typing import List

app = FastAPI()

# Load CLIP model at startup
print("Loading CLIP model...")
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)
print(f"CLIP model loaded on {device}")

class ImagePaths(BaseModel):
    paths: List[str]

class Embeddings(BaseModel):
    emb1: List[float]
    emb2: List[float]

@app.post("/embeddings")
async def generate_embeddings(data: ImagePaths):
    """Generate CLIP embeddings for multiple images"""
    embeddings = []
    
    for path in data.paths:
        try:
            image = Image.open(path).convert('RGB')
            inputs = processor(images=image, return_tensors="pt").to(device)
            
            with torch.no_grad():
                features = model.get_image_features(**inputs)
                # Normalize
                embedding = features / features.norm(dim=-1, keepdim=True)
                embeddings.append(embedding[0].cpu().numpy().tolist())
        except Exception as e:
            print(f"Error processing {path}: {e}")
            embeddings.append(None)
    
    return {"embeddings": embeddings}

@app.post("/similarity")
async def calculate_similarity(data: Embeddings):
    """Calculate cosine similarity between two embeddings"""
    emb1 = np.array(data.emb1)
    emb2 = np.array(data.emb2)
    
    # Cosine similarity
    similarity = float(np.dot(emb1, emb2))
    
    return {"similarity": similarity}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")

