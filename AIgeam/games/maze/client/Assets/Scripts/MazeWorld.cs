using UnityEngine;
using Unity.Entities;
using Unity.Mathematics;
using Unity.Collections;
using Unity.Jobs;
using Unity.Rendering;
using Unity.Transforms;

public class MazeWorld : MonoBehaviour {
    public Material chunkMaterial;
    public int renderDistance = 5;
    
    private NativeHashMap<int2, ChunkData> chunkData;
    private Dictionary<int2, MazeChunk> loadedChunks;
    private int2 playerChunk;
    
    void Start() {
        chunkData = new NativeHashMap<int2, ChunkData>(100, Allocator.Persistent);
        loadedChunks = new Dictionary<int2, MazeChunk>();
        
        StartCoroutine(UpdateChunks());
    }

    IEnumerator UpdateChunks() {
        while (true) {
            var newChunk = GetCurrentChunk();
            if (!newChunk.Equals(playerChunk)) {
                playerChunk = newChunk;
                yield return StartCoroutine(ReloadChunks());
            }
            yield return new WaitForSeconds(0.1f);
        }
    }

    IEnumerator ReloadChunks() {
        // 卸载旧区块
        var toRemove = new List<int2>();
        foreach (var pos in loadedChunks.Keys) {
            if (math.distance(pos, playerChunk) > renderDistance) {
                Destroy(loadedChunks[pos].gameObject);
                toRemove.Add(pos);
            }
        }
        foreach (var pos in toRemove) loadedChunks.Remove(pos);

        // 加载新区块
        var loadJobs = new List<JobHandle>();
        for (int x = -renderDistance; x <= renderDistance; x++) {
            for (int y = -renderDistance; y <= renderDistance; y++) {
                var chunkPos = new int2(playerChunk.x + x, playerChunk.y + y);
                if (!loadedChunks.ContainsKey(chunkPos)) {
                    var job = new GenerateChunkJob {
                        position = chunkPos,
                        result = chunkData
                    };
                    loadJobs.Add(job.Schedule());
                }
            }
        }
        JobHandle.CompleteAll(loadJobs.ToArray());

        // 实例化区块
        foreach (var pos in chunkData.GetKeyArray(Allocator.Temp)) {
            if (!loadedChunks.ContainsKey(pos)) {
                var data = chunkData[pos];
                var chunkObj = new GameObject($"Chunk_{pos.x}_{pos.y}");
                var chunk = chunkObj.AddComponent<MazeChunk>();
                chunk.Initialize(data, chunkMaterial);
                loadedChunks.Add(pos, chunk);
            }
        }
    }

    int2 GetCurrentChunk() {
        var playerPos = transform.position;
        return new int2(
            Mathf.FloorToInt(playerPos.x / 16),
            Mathf.FloorToInt(playerPos.z / 16)
        );
    }

    void OnDestroy() {
        if (chunkData.IsCreated) {
            chunkData.Dispose();
        }
    }
}

public struct ChunkData {
    public int2 position;
    public NativeArray<byte> layout;
}

public struct GenerateChunkJob : IJob {
    public int2 position;
    public NativeHashMap<int2, ChunkData> result;
    
    public void Execute() {
        // 这里会调用Rust的WFC算法生成地形
        // 通过P/Invoke调用native库
        var layout = new NativeArray<byte>(256, Allocator.Persistent);
        // GenerateMazeChunk(position.x, position.y, layout);
        
        result[position] = new ChunkData {
            position = position,
            layout = layout
        };
    }
} 