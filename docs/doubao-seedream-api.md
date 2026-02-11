# 豆包Seedream API 文档

## API资料

模型ID：doubao-seedream-4-5-251128

## 核心功能

### 1. 文生图 (Text-to-Image)
- 支持单张图片生成
- 支持组图生成 (sequential_image_generation)

### 2. 图生图 (Image-to-Image)
- 单张参考图生成单张图
- 多张参考图生成单张图
- 单张参考图生成组图
- 多张参考图生成组图

### 3. 关键参数

#### sequential_image_generation
- `"disabled"`: 生成单张图片
- `"auto"`: 自动生成组图

#### sequential_image_generation_options
```json
{
  "max_images": 3  // 最大生成图片数量
}
```

#### size 参数
- `"2K"`: 自动选择合适的2K分辨率
- `"2048x2048"`: 指定具体像素值

#### stream 参数
- `true`: 流式输出，实时返回生成结果
- `false`: 非流式输出，等待全部完成后返回

## API调用示例

### 生成单张图
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "doubao-seedream-4-5-251128",
    "prompt": "星际穿越，黑洞，黑洞里冲出一辆快支离破碎的复古列车",
    "size": "2K",
    "sequential_image_generation": "disabled",
    "stream": false,
    "response_format": "url",
    "watermark": true
}'
```

### 文生组图
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "doubao-seedream-4-5-251128",
    "prompt": "生成一组共4张连贯插画，核心为同一庭院一角的四季变迁",
    "size": "2K",
    "sequential_image_generation": "auto",
    "sequential_image_generation_options": {
        "max_images": 4
    },
    "stream": false,
    "response_format": "url",
    "watermark": true
}'
```

### 单张图生成单张图
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "doubao-seedream-4-5-251128",
    "prompt": "生成狗狗趴在草地上的近景画面",
    "image": "https://example.com/image.png",
    "size": "2K",
    "sequential_image_generation": "disabled",
    "stream": false,
    "response_format": "url",
    "watermark": true
}'
```

### 多张参考图生成单张图
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "doubao-seedream-4-5-251128",
    "prompt": "将图1的服装换为图2的服装",
    "image": ["https://example.com/image1.png", "https://example.com/image2.png"],
    "size": "2K",
    "sequential_image_generation": "disabled",
    "stream": false,
    "response_format": "url",
    "watermark": true
}'
```

### 单张图生组图
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "doubao-seedream-4-5-251128",
    "prompt": "参考这个LOGO，做一套户外运动品牌视觉设计，包括包装袋、帽子、纸盒、手环、挂绳等",
    "image": "https://example.com/logo.png",
    "size": "2K",
    "sequential_image_generation": "auto",
    "sequential_image_generation_options": {
        "max_images": 5
    },
    "stream": false,
    "response_format": "url",
    "watermark": true
}'
```

### 多张图生组图
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "doubao-seedream-4-5-251128",
    "prompt": "生成3张女孩和奶牛玩偶在游乐园开心地坐过山车的图片，涵盖早晨、中午、晚上",
    "image": ["https://example.com/image1.png", "https://example.com/image2.png"],
    "size": "2K",
    "sequential_image_generation": "auto",
    "sequential_image_generation_options": {
        "max_images": 3
    },
    "stream": false,
    "response_format": "url",
    "watermark": true
}'
```

## 流式输出示例

### 请求
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "doubao-seedream-4-5-251128",
    "prompt": "生成3张女孩和奶牛玩偶在游乐园开心地坐过山车的图片，涵盖早晨、中午、晚上",
    "image": ["https://example.com/image1.png", "https://example.com/image2.png"],
    "sequential_image_generation": "auto",
    "sequential_image_generation_options": {
        "max_images": 3
    },
    "size": "2K",
    "stream": true,
    "watermark": true
}'
```

### 响应格式
```
event: image_generation.partial_succeeded
data: {"type":"image_generation.partial_succeeded","model":"doubao-seedream-4-5-251128","created":1757418675,"image_index":0,"url":"https://...","size":"2720x1536"}

event: image_generation.partial_succeeded
data: {"type":"image_generation.partial_succeeded","model":"doubao-seedream-4-5-251128","created":1757418707,"image_index":1,"url":"https://...","size":"2720x1536"}

event: image_generation.partial_succeeded
data: {"type":"image_generation.partial_succeeded","model":"doubao-seedream-4-5-251128","created":1757418742,"image_index":2,"url":"https://...","size":"2720x1536"}

event: image_generation.completed
data: {"type":"image_generation.completed","model":"doubao-seedream-4-5-251128","created":1757418742,"usage":{"generated_images":3,"output_tokens":48960,"total_tokens":48960}}

data: [DONE]
```

## 非流式输出示例

### 单张图输出
```json
{
    "model": "doubao-seedream-4-5-251128",
    "created": 1757321139,
    "data": [
        {
            "url": "https://...",
            "size": "3104x1312"
        }
    ],
    "usage": {
        "generated_images": 1,
        "output_tokens": 16384,
        "total_tokens": 16384
    }
}
```

### 组图输出
```json
{
    "model": "doubao-seedream-4-5-251128",
    "created": 1757322902,
    "data": [
        {
            "url": "https://...",
            "size": "2336x1760"
        },
        {
            "url": "https://...",
            "size": "2336x1760"
        },
        {
            "url": "https://...",
            "size": "2336x1760"
        },
        {
            "url": "https://...",
            "size": "2336x1760"
        }
    ],
    "usage": {
        "generated_images": 4,
        "output_tokens": 64240,
        "total_tokens": 64240
    }
}
```

## 关键特性

1. **智能组图生成**: 通过 `sequential_image_generation: "auto"` 和 `max_images` 参数控制
2. **多图参考**: `image` 参数支持字符串（单图）或数组（多图）
3. **流式输出**: 支持实时返回生成结果，提升用户体验
4. **灵活尺寸**: 支持 "2K" 自动选择或具体像素值
5. **水印控制**: 通过 `watermark` 参数控制是否添加水印
