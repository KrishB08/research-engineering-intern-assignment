import time
import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from backend.analytics.clustering import run_clustering
from backend.main import label_cluster

start = time.time()
print("Running clustering...")
result = run_clustering()
print(f"Clustering took {time.time() - start:.2f}s")
print("Found clusters:", result.get("n_clusters"))
