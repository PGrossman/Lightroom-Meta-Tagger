"""
============================================================================
CLIP SIMILARITY SERVICE - OPTIMIZED FOR APPLE SILICON
============================================================================
FastAPI service for generating CLIP embeddings and calculating similarity
Automatically uses Apple Silicon GPU (MPS) if available for 3-6x speedup
============================================================================
"""

from fastapi import FastAPI
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import torch
import numpy as np
from pydantic import BaseModel
from typing import List
import sys

app = FastAPI()


def get_optimal_device():
    """
    Detect and return the optimal device for computation
    Priority: MPS (Apple Silicon) > CUDA (NVIDIA) > CPU
    """
    if torch.backends.mps.is_available() and torch.backends.mps.is_built():
        print("🚀 Using Apple Silicon GPU (MPS) for CLIP embeddings")
        print("   Expected speedup: 3-6x faster than CPU")
        return "mps"
    elif torch.cuda.is_available():
        print("🚀 Using NVIDIA GPU (CUDA) for CLIP embeddings")
        return "cuda"
    else:
        print("⚠️  Using CPU for CLIP embeddings (slower)")
        print("   For better performance on Apple Silicon:")
        print("   Run: ./install_pytorch_mps.sh")
        return "cpu"


# Initialize CLIP model with GPU acceleration
print("\n" + "=" * 70)
print("🎨 Loading CLIP Model...")
print("=" * 70)

try:
    device = get_optimal_device()
    
    print(f"\n📥 Downloading model (if not cached)...")
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    
    print(f"📍 Moving model to {device.upper()}...")
    model = model.to(device)
    model.eval()  # Set to evaluation mode for inference (faster)
    
    print(f"\n✅ CLIP model ready on {device.upper()}!")
    print(f"   PyTorch version: {torch.__version__}")
    print(f"   Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    print("=" * 70 + "\n")
    
except Exception as e:
    print(f"\n❌ ERROR: Failed to load CLIP model: {e}")
    print("   The service will not be able to process images.")
    sys.exit(1)

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
    """Health check endpoint with device information"""
    return {
        "status": "healthy",
        "device": str(device),
        "device_type": device,
        "mps_available": torch.backends.mps.is_available() if hasattr(torch.backends, 'mps') else False,
        "cuda_available": torch.cuda.is_available(),
        "pytorch_version": torch.__version__
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")

