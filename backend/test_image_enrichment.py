"""
Test script to validate image enrichment for citations.
Tests that images are fetched and included in the API response.
"""
import requests
import json
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

API_BASE_URL = "http://localhost:8000"

def test_image_enrichment():
    """Test that images are enriched for citations."""
    print("🧪 Testing Image Enrichment for Citations")
    print("=" * 60)
    
    # Test query that should return citations with images
    test_query = "artificial intelligence"
    print(f"\n📝 Query: {test_query}")
    print("\n⏳ Sending request to backend...")
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/ask",
            json={
                "query": test_query
            },
            timeout=120  # Image searches may take longer
        )
        
        if response.status_code != 200:
            print(f"❌ Request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        print("\n✅ Request successful!")
        print("\n📊 Response Summary:")
        print(f"   - Question: {data.get('question')}")
        print(f"   - Overview: {data.get('overview', '')[:100]}...")
        print(f"   - Overview Image: {'✅ Present' if data.get('overview_image') else '❌ Missing'}")
        print(f"   - Topics: {len(data.get('topics', []))}")
        print(f"   - Sources: {len(data.get('sources', []))}")
        
        sources = data.get('sources', [])
        if not sources:
            print("\n⚠️  No sources found in response")
            return False
        
        print("\n📸 Source Image Status:")
        images_found = 0
        images_missing = 0
        
        for i, source in enumerate(sources, 1):
            source_image = source.get('image')
            status = "✅ Has image" if source_image else "❌ No image"
            print(f"   [{i}] {source.get('title', 'Unknown')[:50]}")
            print(f"       {status}")
            if source_image:
                print(f"       URL: {source_image[:80]}...")
                images_found += 1
            else:
                images_missing += 1
        
        print(f"\n📈 Results:")
        print(f"   - Sources with images: {images_found}/{len(sources)}")
        print(f"   - Sources without images: {images_missing}/{len(sources)}")
        
        if images_found > 0:
            print("\n✅ SUCCESS: Image enrichment is working!")
            print(f"   Found images for {images_found} out of {len(sources)} sources")
            return True
        else:
            print("\n⚠️  WARNING: No images found for any sources")
            print("   This could be due to:")
            print("   - API credentials not configured")
            print("   - Image search API issues")
            print("   - No suitable images found")
            return False
        
    except requests.exceptions.ConnectionError:
        print(f"\n❌ ERROR: Could not connect to backend at {API_BASE_URL}")
        print("   Make sure the backend server is running:")
        print("   cd backend && python -m uvicorn backend.app.api.main:app --reload")
        return False
    except requests.exceptions.Timeout:
        print("\n❌ ERROR: Request timed out")
        print("   Image searches may take longer. Try increasing timeout.")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {e}")
        return False


if __name__ == "__main__":
    success = test_image_enrichment()
    sys.exit(0 if success else 1)

