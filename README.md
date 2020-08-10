
## 测试结果

| IPVT        | 使用的编解码     | OpenH264 软编码        | ExternalDecoder 硬解码 | ExternalEncoder 硬编码 | ExternalDecoder  硬解码 | 黑屏 |                                       |
|-------------|------------------|------------------------|------------------------|------------------------|-------------------------|------|---------------------------------------|
|             | profile-level-id | 420028                 | 420028                 | 42001f                 | 42001f                  | 黑屏 |                                       |
|             | 使用的编解码     | ExternalEncoder 硬编码 | ExternalDecoder 硬解码 | ExternalEncoder 硬编码 | ExternalDecoder  硬解码 | 黑屏 |                                       |
|             | profile-level-id | 42001f                 | 42001f                 | 42001f                 | 42001f                  | 黑屏 |                                       |
| webRTC Demo | 使用的编解码     | ExternalEncoder 硬编码 | ExternalDecoder 硬解码 | ExternalEncoder 硬编码 | ExternalDecoder  硬解码 | 黑屏 | DEMO两个点对点连接都在本地同一个tab页 |
|             | profile-level-id | 42001f                 | 42001f                 | 42001f                 | 42001f                  | 黑屏 |                                       |


## 软件解码 OpenH264



## FAQ

- 获取的流再次通过P2P发送时，发送的数据量很小
