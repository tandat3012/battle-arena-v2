# Kết quả kiểm tra phục hồi (restore) — Redis V2

Các kết quả chạy mới được `scripts/restore-verify.sh` tự ghi thêm ở cuối file; phần ghi chú đầu file giải thích giới hạn của lần chạy lịch sử.

> **Lưu ý về bằng chứng cũ:** lần kiểm tra bên dưới (18/11/2026) chạy bản script chỉ xác nhận nhiều lệnh trả về dữ liệu không rỗng và so khớp một số lượng tổng. `14 OK / 0 FAIL` không chứng minh toàn bộ giá trị đã khôi phục chính xác. Seed định nghĩa 34 trận; snapshot lịch sử ghi nhận 35 trận, nên snapshot không khớp nguyên trạng seed. Tài liệu hiện có không xác định nguyên nhân chênh lệch. Chưa có kết quả chạy lại bằng bản script so sánh toàn bộ key/value ở thời điểm sửa tài liệu này.

## Lần kiểm tra 2026-11-18 12:22:46 +0700

- File: `backups/battle-arena-v2-20261118-122115.rdb` (sha256 `d715df149d111401…`)
- Instance restore: `redis:8.8.4`, volume Docker trống `ba-v2-restore-data`, `appendonly no`, cổng 127.0.0.1:6381 (cách cũ; bản script mới dùng thư mục tạm riêng và không xóa Docker volume)
- Kết quả: **14 OK / 0 FAIL**

| Trạng thái | Lệnh | Kết quả trên restore | Redis V2 gốc lúc kiểm tra |
|---|---|---|---|
| OK | `PING` | PONG | PONG |
| OK | `INFO server` | redis_version:8.8.4 | redis_version:8.8.4 |
| OK | `SCARD ba:v2:players` | 24 | 24 |
| OK | `SMEMBERS ba:v2:seasons` | s2026_01 s2026_02 | s2026_01 s2026_02 |
| OK | `GET ba:v2:season:active` | s2026_02 | s2026_02 |
| OK | `ZRANGE ba:v2:season:s2026_01:leaderboard 0 4 REV WITHSCORES` | player09 900 player07 600 player01 600 player23 300 player21 300 | player09 900 player07 600 player01 600 player23 300 player21 300 |
| OK | `ZRANGE ba:v2:season:s2026_02:leaderboard 0 4 REV WITHSCORES` | player07 900 player10 600 player09 600 player05 600 player24 300 | player07 900 player10 600 player09 600 player05 600 player24 300 |
| OK | `HMGET ba:v2:player:player01 displayName totalWins totalLosses status` | Nguyễn Văn Minh 3 2 active | Nguyễn Văn Minh 3 2 active |
| OK | `HMGET ba:v2:match:327900b1-9a63-4bb8-b09c-c5c5494b1765 seasonId mode winnerId pointsAwarded` | s2026_02 ranked_1v1 player24 300 | s2026_02 ranked_1v1 player24 300 |
| OK | `SCARD ba:v2:match:ids` | 35 | 35 |
| OK | `LLEN ba:v2:matches:recent` | 35 | 35 |
| OK | `XLEN ba:v2:events` | 73 | 73 |
| OK | `XREVRANGE ba:v2:events + - COUNT 1` | 1794978940679-0 type match.recorded actorId admin entityId 327900b1-9a63-4bb8-b09c-c5c5494b1765 occurredAt 2026-11-18T05:15:40.678Z summary player24 thắng player08 (ranked_1v1, +300) metadata {"winnerId":"player24","loserId":"player08","mode":"ranked_1v1","seasonId":"s2026_02","pointsAwarded":300} | 1794978940679-0 type match.recorded actorId admin entityId 327900b1-9a63-4bb8-b09c-c5c5494b1765 occurredAt 2026-11-18T05:15:40.678Z summary player24 thắng player08 (ranked_1v1, +300) metadata {"winnerId":"player24","loserId":"player08","mode":"ranked_1v1","seasonId":"s2026_02","pointsAwarded":300} |
| OK | `FT.SEARCH idx:ba:v2:players @country:{VN} @level:[10 +inf] @status:{active} NOCONTENT` | 3 ba:v2:player:player19 ba:v2:player:player03 ba:v2:player:player01 | 3 ba:v2:player:player01 ba:v2:player:player19 ba:v2:player:player03 |

## Lần kiểm tra 2026-11-22 15:10:05 +0700

- File: `backups/battle-arena-v2-20261122-150730.rdb` (sha256 `c39ff85db68e1d10e393cf0a0f68e1ca5d38e81c3cf0aa5ff772032d390d9169`)
- Instance restore: `redis:8.8.4`, thư mục tạm bind mount (không dùng Docker volume), `appendonly no`, cổng 127.0.0.1:6381
- Đối chiếu thực hiện với Redis V2 nguồn đang chạy; nguồn phải giữ nguyên từ lúc tạo backup đến hết kiểm tra. Session và bộ đếm đăng nhập có TTL được loại khỏi so sánh key/value.
- Kết quả: **151 OK / 2 FAIL**

| Trạng thái | Kiểm tra | Restore | Redis V2 nguồn |
|---|---|---|---|
45
| OK | Redis version | 8.8.4 | 8.8.4 |
| OK | Số người chơi | 24 | 24 |
| OK | Mùa giải | s2026_01 s2026_02 | s2026_01 s2026_02 |
| OK | Mùa active | s2026_02 | s2026_02 |
| OK | Số trận | 34 | 34 |
| OK | LLEN recent | 34 | 34 |
| OK | XLEN events | 72 | 72 |
| OK | Tập key ba:v2: (bỏ session/counter tạm) | 143 key | 143 key |
| OK | Value ba:v2:events | stream · sha256 6f511d51e616d6993d90bfacad584480611281650c20c72dfe3fa28f4310bbae · TTL -1 | stream · sha256 6f511d51e616d6993d90bfacad584480611281650c20c72dfe3fa28f4310bbae · TTL -1 |
| FAIL | Value ba:v2:game:config | hash · sha256 45435f8816d4c233ab0485fec66e276a8df75d7b05d958c8587f1978d12fe4d2 · TTL -1 | hash · sha256 4eb363015bf8937e48ba4307b0e1c828f3709aadd35a068f03dbcc6092f5bc7e · TTL -1 |
| OK | Value ba:v2:match:09c9044c-bf0e-46fe-b983-8e5986a0f516 | hash · sha256 c265e080a2b68246d935049dd620a458941df795f86f1d884aa4fb13d41db616 · TTL -1 | hash · sha256 c265e080a2b68246d935049dd620a458941df795f86f1d884aa4fb13d41db616 · TTL -1 |
| OK | Value ba:v2:match:0b28233c-591e-4466-bcc4-2318b5186990 | hash · sha256 e519bae97494833335c3a783c17d852be1932be7abdc01df79031f72dde53735 · TTL -1 | hash · sha256 e519bae97494833335c3a783c17d852be1932be7abdc01df79031f72dde53735 · TTL -1 |
| OK | Value ba:v2:match:0de84489-fbc5-4ac8-96b4-c0792caac256 | hash · sha256 3a1884f67baa54b9ae83fb499eec39984fcad359f2d7972706d8ce8e873f544d · TTL -1 | hash · sha256 3a1884f67baa54b9ae83fb499eec39984fcad359f2d7972706d8ce8e873f544d · TTL -1 |
| OK | Value ba:v2:match:1329d33a-8aeb-490c-b183-cbf8734867f5 | hash · sha256 9566535b49543aa9e706ecec045353c94255b1d25e3523a8b4df8c78a6f8fb4b · TTL -1 | hash · sha256 9566535b49543aa9e706ecec045353c94255b1d25e3523a8b4df8c78a6f8fb4b · TTL -1 |
| OK | Value ba:v2:match:28294f3a-cec2-4940-9526-be9ae7c60ecd | hash · sha256 4455c97f12c3eceb1244df7fc33cd7bad14e7d6b349c3fdc41ba33dd6cc11130 · TTL -1 | hash · sha256 4455c97f12c3eceb1244df7fc33cd7bad14e7d6b349c3fdc41ba33dd6cc11130 · TTL -1 |
| OK | Value ba:v2:match:373dbb4a-879b-4671-9499-8ab55b53700a | hash · sha256 320b467ef47e6955f204d91ffc0bd70e1dba360e7d49a35a18fe244fb7d30c9d · TTL -1 | hash · sha256 320b467ef47e6955f204d91ffc0bd70e1dba360e7d49a35a18fe244fb7d30c9d · TTL -1 |
| OK | Value ba:v2:match:3eb9e81f-b13c-47db-851d-046b0067b612 | hash · sha256 e24080094c8fd90e6e182efc4d262a5675c005c56525922dcf84dd65e04701cf · TTL -1 | hash · sha256 e24080094c8fd90e6e182efc4d262a5675c005c56525922dcf84dd65e04701cf · TTL -1 |
| OK | Value ba:v2:match:44fb3463-10f5-4061-8a03-68e68d34b8a1 | hash · sha256 52e166bd70aea1cee37d562e44268aa3a7a9dbfee9762db2cb7cdbb195095a0d · TTL -1 | hash · sha256 52e166bd70aea1cee37d562e44268aa3a7a9dbfee9762db2cb7cdbb195095a0d · TTL -1 |
| OK | Value ba:v2:match:5306ce6b-be23-4f7c-99c7-006d54281ef0 | hash · sha256 77994d962e0c06fa43de64b99145e04cabe7707ae5c61455407140d3aaba4d2e · TTL -1 | hash · sha256 77994d962e0c06fa43de64b99145e04cabe7707ae5c61455407140d3aaba4d2e · TTL -1 |
| OK | Value ba:v2:match:6e618fd7-031a-43d4-abdc-30f78a1fc812 | hash · sha256 2fa7421e46be77682fab1e02d348ba531d9bdb6a0e0320860926ec444de54e48 · TTL -1 | hash · sha256 2fa7421e46be77682fab1e02d348ba531d9bdb6a0e0320860926ec444de54e48 · TTL -1 |
| OK | Value ba:v2:match:6f2154b4-d06b-4253-8785-033d5822f379 | hash · sha256 443cc4170181a9474a07deea12ce83439f4ed3a4a6bc02f4085024e4386dc088 · TTL -1 | hash · sha256 443cc4170181a9474a07deea12ce83439f4ed3a4a6bc02f4085024e4386dc088 · TTL -1 |
| OK | Value ba:v2:match:755231f4-cd5c-40b9-b536-8b561358cccf | hash · sha256 67999cdd2da6631512dbdcb125d8235422ae3ed9d7e77002acf335f236fd0462 · TTL -1 | hash · sha256 67999cdd2da6631512dbdcb125d8235422ae3ed9d7e77002acf335f236fd0462 · TTL -1 |
| OK | Value ba:v2:match:763da0aa-9469-406b-a4d5-cb10d36981aa | hash · sha256 2dd2eb602c88e523cd4c188fb9e924b790d8bd2e6275d01c234a48bef8afbdd1 · TTL -1 | hash · sha256 2dd2eb602c88e523cd4c188fb9e924b790d8bd2e6275d01c234a48bef8afbdd1 · TTL -1 |
| OK | Value ba:v2:match:7e75eee7-c3d7-477a-88ab-a4b932858cce | hash · sha256 50710b4c639cabe3442b35c54f13ca18616ed3f5a2e89dc81f0f20249c70985e · TTL -1 | hash · sha256 50710b4c639cabe3442b35c54f13ca18616ed3f5a2e89dc81f0f20249c70985e · TTL -1 |
| OK | Value ba:v2:match:82888af8-337f-4dc3-af19-42f3a3176900 | hash · sha256 1e77dacabc9204d52c9dcc5230c18bbb27b1498050c79c6a10ed872eef32abe2 · TTL -1 | hash · sha256 1e77dacabc9204d52c9dcc5230c18bbb27b1498050c79c6a10ed872eef32abe2 · TTL -1 |
| OK | Value ba:v2:match:89b6c629-be57-40da-8954-b21528268cd2 | hash · sha256 633e3158ea15bd69fd132ade702ba6b769490382de9e4a4dc90925c09e355776 · TTL -1 | hash · sha256 633e3158ea15bd69fd132ade702ba6b769490382de9e4a4dc90925c09e355776 · TTL -1 |
| OK | Value ba:v2:match:96e198c2-cf60-4a81-af6f-eb4d1943f64f | hash · sha256 71734fa6c421703c9fa4805dc58a2b17c21889af8c5f62be66b8c63c8a658590 · TTL -1 | hash · sha256 71734fa6c421703c9fa4805dc58a2b17c21889af8c5f62be66b8c63c8a658590 · TTL -1 |
| OK | Value ba:v2:match:97971edb-c2c5-4a2c-90da-9f94146aa060 | hash · sha256 d085d26eaa4be970fcb1fa9a1de000094ecef3a45f8347b52451f645e3ba1f50 · TTL -1 | hash · sha256 d085d26eaa4be970fcb1fa9a1de000094ecef3a45f8347b52451f645e3ba1f50 · TTL -1 |
| OK | Value ba:v2:match:a50d0dc1-a087-421c-bd4b-fcdfa213812d | hash · sha256 cc826df81507add1c7a832398e03e56e116724aacbfdae2d60c66ae88d3948dc · TTL -1 | hash · sha256 cc826df81507add1c7a832398e03e56e116724aacbfdae2d60c66ae88d3948dc · TTL -1 |
| OK | Value ba:v2:match:a8b0d0f9-6b1d-4794-874e-8a7222dbeb7d | hash · sha256 e32a57fc73ac7a71a7bab1993ccc2c13e4737c3a06af614d4c982ac538edb9dd · TTL -1 | hash · sha256 e32a57fc73ac7a71a7bab1993ccc2c13e4737c3a06af614d4c982ac538edb9dd · TTL -1 |
| OK | Value ba:v2:match:ac170863-ae95-4c5b-9f8f-dab0a8489611 | hash · sha256 bfcacc9917d071721978974ec3898b12acfd74255f247eb4efbf58cd9abbb0c0 · TTL -1 | hash · sha256 bfcacc9917d071721978974ec3898b12acfd74255f247eb4efbf58cd9abbb0c0 · TTL -1 |
| OK | Value ba:v2:match:aea01161-29e6-406c-890b-99ed104a117d | hash · sha256 f79b617f7d65d9d3e9c3232263f61edc3bf18f68f0467dd52cd43772f7c628ae · TTL -1 | hash · sha256 f79b617f7d65d9d3e9c3232263f61edc3bf18f68f0467dd52cd43772f7c628ae · TTL -1 |
| OK | Value ba:v2:match:af1f4ad7-baa2-42fb-b053-7f5a77df2e49 | hash · sha256 769f1a635d6394a0dd7de772778335a593dd2fc6f177685aa149ffb74ddfd54b · TTL -1 | hash · sha256 769f1a635d6394a0dd7de772778335a593dd2fc6f177685aa149ffb74ddfd54b · TTL -1 |
| OK | Value ba:v2:match:b3b3c644-811f-4f9f-9731-f2ee5af7bd08 | hash · sha256 b36f034dda69efe2efa4a42a109585931e5af56b017a58a6fc4be45e31af320e · TTL -1 | hash · sha256 b36f034dda69efe2efa4a42a109585931e5af56b017a58a6fc4be45e31af320e · TTL -1 |
| OK | Value ba:v2:match:bdc1cb08-8be6-45ae-be80-3160ebf51b89 | hash · sha256 a68ea6ff37635d2b870fcce31f3d5a027d3caa99c2611f8e109e0b8f8d097dbb · TTL -1 | hash · sha256 a68ea6ff37635d2b870fcce31f3d5a027d3caa99c2611f8e109e0b8f8d097dbb · TTL -1 |
| OK | Value ba:v2:match:c0867c84-2d6b-474e-92ef-0609069a19fc | hash · sha256 fe0358134ed19012202a2c36dbd2df322e7deb6149df2dd984c0a879d4528628 · TTL -1 | hash · sha256 fe0358134ed19012202a2c36dbd2df322e7deb6149df2dd984c0a879d4528628 · TTL -1 |
| OK | Value ba:v2:match:c38d6c6b-6a5a-4cd8-8133-cc399021fd91 | hash · sha256 0b439a103c97f5a7135029f7f5e7572f444c6d40068c812f0e2b0fdcc52b701f · TTL -1 | hash · sha256 0b439a103c97f5a7135029f7f5e7572f444c6d40068c812f0e2b0fdcc52b701f · TTL -1 |
| OK | Value ba:v2:match:c53a58a8-1eda-498d-b67c-443b6a489c72 | hash · sha256 8cb779c9a79af90275a2c483ff860b6aaaeda11ec64eb29d04cd37bd545c4d32 · TTL -1 | hash · sha256 8cb779c9a79af90275a2c483ff860b6aaaeda11ec64eb29d04cd37bd545c4d32 · TTL -1 |
| OK | Value ba:v2:match:d47492f7-dda3-4a9a-827a-ce8aba36455e | hash · sha256 ea0051f8dc29a3d97f60e04237843cc26ca72580c124f2fac13fe0cb93a7b39a · TTL -1 | hash · sha256 ea0051f8dc29a3d97f60e04237843cc26ca72580c124f2fac13fe0cb93a7b39a · TTL -1 |
| OK | Value ba:v2:match:e4b98bd1-5c87-48b5-a4df-f9b28beee129 | hash · sha256 8fa954001a256993761b9017472a3e17fbc6dfaf32042b54e8f41449fafdaa15 · TTL -1 | hash · sha256 8fa954001a256993761b9017472a3e17fbc6dfaf32042b54e8f41449fafdaa15 · TTL -1 |
| OK | Value ba:v2:match:e7e08698-5641-48eb-9a93-96eb2afed0f4 | hash · sha256 255d03db9e17ce1395106dfb082a8ce5600447980f9db172c0a5fe124a5dcaf0 · TTL -1 | hash · sha256 255d03db9e17ce1395106dfb082a8ce5600447980f9db172c0a5fe124a5dcaf0 · TTL -1 |
| OK | Value ba:v2:match:e9f04360-1fa9-418f-8665-97fe90256077 | hash · sha256 354cd16e828514c0342fcffd3ed443df15dec5ffd2dbf22b52bfc91b43e55444 · TTL -1 | hash · sha256 354cd16e828514c0342fcffd3ed443df15dec5ffd2dbf22b52bfc91b43e55444 · TTL -1 |
| OK | Value ba:v2:match:f0ab8506-53b7-4c73-8b10-f711a9262a02 | hash · sha256 3b890d24767348e6b77f811b358c04037c35326c77ed89cb9b1a30282fb3c4fa · TTL -1 | hash · sha256 3b890d24767348e6b77f811b358c04037c35326c77ed89cb9b1a30282fb3c4fa · TTL -1 |
| OK | Value ba:v2:match:f35c47b5-999d-4c7f-ab91-157614ccca16 | hash · sha256 a47ad81e18dc393653f0e74f143f39a94d19e8906f7be6f51419325a70a18011 · TTL -1 | hash · sha256 a47ad81e18dc393653f0e74f143f39a94d19e8906f7be6f51419325a70a18011 · TTL -1 |
| OK | Value ba:v2:match:ids | set · sha256 275fcc23122dd58b3f5dec40aa4853bc7d5a40541ee4859a9e30501a4022fca4 · TTL -1 | set · sha256 275fcc23122dd58b3f5dec40aa4853bc7d5a40541ee4859a9e30501a4022fca4 · TTL -1 |
| OK | Value ba:v2:matches:recent | list · sha256 2b84eabddcd3330acc1bbecddc0d64f4d44d2bb0ccf29d04deb795c895ad9a1b · TTL -1 | list · sha256 2b84eabddcd3330acc1bbecddc0d64f4d44d2bb0ccf29d04deb795c895ad9a1b · TTL -1 |
| OK | Value ba:v2:online:last_seen | zset · sha256 d532384f542659862743c32b5699e9db256aab3e98f25fdf3626b43420b7c96f · TTL -1 | zset · sha256 d532384f542659862743c32b5699e9db256aab3e98f25fdf3626b43420b7c96f · TTL -1 |
| OK | Value ba:v2:player:player01 | hash · sha256 e333b55dd10210e00d0e7d7009d71dba37b57ad8fd093970d4a4487d5c110310 · TTL -1 | hash · sha256 e333b55dd10210e00d0e7d7009d71dba37b57ad8fd093970d4a4487d5c110310 · TTL -1 |
| OK | Value ba:v2:player:player01:matches | zset · sha256 085c16f45ac2fffd422715b749b1e34398c43db1526d62a07f56d0a70031a94a · TTL -1 | zset · sha256 085c16f45ac2fffd422715b749b1e34398c43db1526d62a07f56d0a70031a94a · TTL -1 |
| OK | Value ba:v2:player:player02 | hash · sha256 9f45b784c8d2d46cda5f06257270953c65edddd9df07fe71f8018a98ba127e90 · TTL -1 | hash · sha256 9f45b784c8d2d46cda5f06257270953c65edddd9df07fe71f8018a98ba127e90 · TTL -1 |
| OK | Value ba:v2:player:player02:matches | zset · sha256 36139ad291cb07ded2f36f5c69ec3c1e1ae3b87acb4190aabc1c20cb1fc495b1 · TTL -1 | zset · sha256 36139ad291cb07ded2f36f5c69ec3c1e1ae3b87acb4190aabc1c20cb1fc495b1 · TTL -1 |
| OK | Value ba:v2:player:player03 | hash · sha256 68ae6dd8a0b3525cd0d9b89f5fce6c35278a1361b125c57e2c015524dbee2b29 · TTL -1 | hash · sha256 68ae6dd8a0b3525cd0d9b89f5fce6c35278a1361b125c57e2c015524dbee2b29 · TTL -1 |
| OK | Value ba:v2:player:player03:matches | zset · sha256 22019367baf5cc4250c687df7c7dcc3ef90edcc3693b7945e2aec194d580fb67 · TTL -1 | zset · sha256 22019367baf5cc4250c687df7c7dcc3ef90edcc3693b7945e2aec194d580fb67 · TTL -1 |
| OK | Value ba:v2:player:player04 | hash · sha256 dce5d9995b4341e0cc839b674be460e184aa900103087c0499bac9bf727f9efa · TTL -1 | hash · sha256 dce5d9995b4341e0cc839b674be460e184aa900103087c0499bac9bf727f9efa · TTL -1 |
| OK | Value ba:v2:player:player04:matches | zset · sha256 ec2810310bdadcae95c2b87faf0c5c1a0feee2ba766881cc523e7b25dcff5413 · TTL -1 | zset · sha256 ec2810310bdadcae95c2b87faf0c5c1a0feee2ba766881cc523e7b25dcff5413 · TTL -1 |
| OK | Value ba:v2:player:player05 | hash · sha256 86a4bfec0a2681cc3bd7e14cc86d0cc58ca7362d9124d05a075e89005a307bed · TTL -1 | hash · sha256 86a4bfec0a2681cc3bd7e14cc86d0cc58ca7362d9124d05a075e89005a307bed · TTL -1 |
| OK | Value ba:v2:player:player05:matches | zset · sha256 e383564c4c088ede9cc1681cd3bfa96e570b1937f09176d8a04a975c0ff935c6 · TTL -1 | zset · sha256 e383564c4c088ede9cc1681cd3bfa96e570b1937f09176d8a04a975c0ff935c6 · TTL -1 |
| OK | Value ba:v2:player:player06 | hash · sha256 dcc9635efc6cc620d5c8990902c5e88b2aa6d2abb2ac3c2172d2a68bf007df14 · TTL -1 | hash · sha256 dcc9635efc6cc620d5c8990902c5e88b2aa6d2abb2ac3c2172d2a68bf007df14 · TTL -1 |
| OK | Value ba:v2:player:player06:matches | zset · sha256 faf9e6fb02d03850f41b4e7085d08dd82b2297fbf238389ae82811255f4d7048 · TTL -1 | zset · sha256 faf9e6fb02d03850f41b4e7085d08dd82b2297fbf238389ae82811255f4d7048 · TTL -1 |
| OK | Value ba:v2:player:player07 | hash · sha256 36f91f3f118870c15fbc44583f6a0f0d250fb3b9fedee00f29a8e717c0913425 · TTL -1 | hash · sha256 36f91f3f118870c15fbc44583f6a0f0d250fb3b9fedee00f29a8e717c0913425 · TTL -1 |
| OK | Value ba:v2:player:player07:matches | zset · sha256 ccb91938722b1071b8baa47b9f4444b372df3a75f1686c1a3856737e8ddd2949 · TTL -1 | zset · sha256 ccb91938722b1071b8baa47b9f4444b372df3a75f1686c1a3856737e8ddd2949 · TTL -1 |
| OK | Value ba:v2:player:player08 | hash · sha256 a24844c0e6949ccca44e6a3d63d0077a1738c74c1228d0c7fb113ec0ca8afad7 · TTL -1 | hash · sha256 a24844c0e6949ccca44e6a3d63d0077a1738c74c1228d0c7fb113ec0ca8afad7 · TTL -1 |
| OK | Value ba:v2:player:player08:matches | zset · sha256 5dc441037ea6391b7dcf69125f9e83c94c5794bdd3bad357adbaafb2f74fa2d8 · TTL -1 | zset · sha256 5dc441037ea6391b7dcf69125f9e83c94c5794bdd3bad357adbaafb2f74fa2d8 · TTL -1 |
| OK | Value ba:v2:player:player09 | hash · sha256 6d3095460fcfb6c3d075166583ce374a6ba47b9fe9b3789be48139c8a75bcec4 · TTL -1 | hash · sha256 6d3095460fcfb6c3d075166583ce374a6ba47b9fe9b3789be48139c8a75bcec4 · TTL -1 |
| OK | Value ba:v2:player:player09:matches | zset · sha256 ae843f37528119ab1a7501ac6a6e32c699c69f0c3f4fb2eca7f0d631aadfa3d0 · TTL -1 | zset · sha256 ae843f37528119ab1a7501ac6a6e32c699c69f0c3f4fb2eca7f0d631aadfa3d0 · TTL -1 |
| OK | Value ba:v2:player:player10 | hash · sha256 f3728a868b30e07f48d0b772655510a2b9b2a9d4fb4a72a0047137e154456b64 · TTL -1 | hash · sha256 f3728a868b30e07f48d0b772655510a2b9b2a9d4fb4a72a0047137e154456b64 · TTL -1 |
| OK | Value ba:v2:player:player10:matches | zset · sha256 6c6fddda82c8df6468917321e370ace79fc67454e66accb9289bb3e03517218e · TTL -1 | zset · sha256 6c6fddda82c8df6468917321e370ace79fc67454e66accb9289bb3e03517218e · TTL -1 |
| OK | Value ba:v2:player:player11 | hash · sha256 baddcf8db2e514bfce6f97eed657b61856a29b82bc77da2ebd8df49d531ed1d8 · TTL -1 | hash · sha256 baddcf8db2e514bfce6f97eed657b61856a29b82bc77da2ebd8df49d531ed1d8 · TTL -1 |
| OK | Value ba:v2:player:player11:matches | zset · sha256 67fd810b60de3eaaf905b5de8bda84c9ae5450b7e9e8e3ed897eb1f344536bdf · TTL -1 | zset · sha256 67fd810b60de3eaaf905b5de8bda84c9ae5450b7e9e8e3ed897eb1f344536bdf · TTL -1 |
| OK | Value ba:v2:player:player12 | hash · sha256 bd315403f697652a9845ada53c8ccde55824e34c5e4f3b42e9d9e434eb27b40c · TTL -1 | hash · sha256 bd315403f697652a9845ada53c8ccde55824e34c5e4f3b42e9d9e434eb27b40c · TTL -1 |
| OK | Value ba:v2:player:player12:matches | zset · sha256 48b5885f1757bab752f560769d847e7c0fd40fba09828a45fbdf7464bfd87e84 · TTL -1 | zset · sha256 48b5885f1757bab752f560769d847e7c0fd40fba09828a45fbdf7464bfd87e84 · TTL -1 |
| OK | Value ba:v2:player:player13 | hash · sha256 e5d4664f7f51c73f5901702f6973a9dfd965bd5c9ae29ec6757139e13c0f71be · TTL -1 | hash · sha256 e5d4664f7f51c73f5901702f6973a9dfd965bd5c9ae29ec6757139e13c0f71be · TTL -1 |
| OK | Value ba:v2:player:player13:matches | zset · sha256 0de35af05079f0eb9f315135c855e802ebb946b22a767d8b47e87af475f78574 · TTL -1 | zset · sha256 0de35af05079f0eb9f315135c855e802ebb946b22a767d8b47e87af475f78574 · TTL -1 |
| OK | Value ba:v2:player:player14 | hash · sha256 45d70817ed296ca5c9e5633847d3bbb2f73fc412900906a25eb070fd77333c5a · TTL -1 | hash · sha256 45d70817ed296ca5c9e5633847d3bbb2f73fc412900906a25eb070fd77333c5a · TTL -1 |
| OK | Value ba:v2:player:player14:matches | zset · sha256 632218ddf1a5ea6c902040bef2552ca0a326b9a2e8a4ad326d0cf88ee1620576 · TTL -1 | zset · sha256 632218ddf1a5ea6c902040bef2552ca0a326b9a2e8a4ad326d0cf88ee1620576 · TTL -1 |
| OK | Value ba:v2:player:player15 | hash · sha256 d3b919ac5ac1d4856f076260da0276a662d615ae1dd099e0618cab2c173d5a5f · TTL -1 | hash · sha256 d3b919ac5ac1d4856f076260da0276a662d615ae1dd099e0618cab2c173d5a5f · TTL -1 |
| OK | Value ba:v2:player:player15:matches | zset · sha256 b70aa344f19bd40b330a4507139537c479c3ee825a90b998e72658911f0d3645 · TTL -1 | zset · sha256 b70aa344f19bd40b330a4507139537c479c3ee825a90b998e72658911f0d3645 · TTL -1 |
| OK | Value ba:v2:player:player16 | hash · sha256 f2e690ca4282ac9e5ffd5ea9c31b7bc74a5999792aaad10a202a573745316e59 · TTL -1 | hash · sha256 f2e690ca4282ac9e5ffd5ea9c31b7bc74a5999792aaad10a202a573745316e59 · TTL -1 |
| OK | Value ba:v2:player:player16:matches | zset · sha256 fae66a25764c3c5661482e961fddeab8c16d1e65412746ab62fd75558b72d597 · TTL -1 | zset · sha256 fae66a25764c3c5661482e961fddeab8c16d1e65412746ab62fd75558b72d597 · TTL -1 |
| OK | Value ba:v2:player:player17 | hash · sha256 c2c619f781a7709cadf5e007f30323a505d8c64bcaed44cbfe4ae68f33ae2022 · TTL -1 | hash · sha256 c2c619f781a7709cadf5e007f30323a505d8c64bcaed44cbfe4ae68f33ae2022 · TTL -1 |
| OK | Value ba:v2:player:player17:matches | zset · sha256 eaa7a0d570e0ce81218a978aa5626a37eb7f656e8c5094b543b4057352207efc · TTL -1 | zset · sha256 eaa7a0d570e0ce81218a978aa5626a37eb7f656e8c5094b543b4057352207efc · TTL -1 |
| OK | Value ba:v2:player:player18 | hash · sha256 0dd75afc1177c4e396f8683771897701402cd5304cb47c385b22c5c41347af33 · TTL -1 | hash · sha256 0dd75afc1177c4e396f8683771897701402cd5304cb47c385b22c5c41347af33 · TTL -1 |
| OK | Value ba:v2:player:player18:matches | zset · sha256 335180885db95be84371d546068e1715b453b9c794c164ee768a5da9c21882e3 · TTL -1 | zset · sha256 335180885db95be84371d546068e1715b453b9c794c164ee768a5da9c21882e3 · TTL -1 |
| OK | Value ba:v2:player:player19 | hash · sha256 5cb218b9bbd47ab230907aec709ff3b84badebdc0f9ecbb3daea381fb9400e77 · TTL -1 | hash · sha256 5cb218b9bbd47ab230907aec709ff3b84badebdc0f9ecbb3daea381fb9400e77 · TTL -1 |
| OK | Value ba:v2:player:player19:matches | zset · sha256 628fb84df65b5b51a4dd7b58f82224324ee083105bb9214bc3e9b62f4cec81c7 · TTL -1 | zset · sha256 628fb84df65b5b51a4dd7b58f82224324ee083105bb9214bc3e9b62f4cec81c7 · TTL -1 |
| OK | Value ba:v2:player:player20 | hash · sha256 fca95f77f490966b7f3efdf0464d605605b4a71d22c415b2707931c13a8d2030 · TTL -1 | hash · sha256 fca95f77f490966b7f3efdf0464d605605b4a71d22c415b2707931c13a8d2030 · TTL -1 |
| OK | Value ba:v2:player:player20:matches | zset · sha256 086724fc6f87772fb44f3d6fcebc5e9021048965c9073721f0002cfd79be0633 · TTL -1 | zset · sha256 086724fc6f87772fb44f3d6fcebc5e9021048965c9073721f0002cfd79be0633 · TTL -1 |
| OK | Value ba:v2:player:player21 | hash · sha256 1aa6c90e989b47a138b5731865dbf665e12061c67d359c42baff90fc9a285c3e · TTL -1 | hash · sha256 1aa6c90e989b47a138b5731865dbf665e12061c67d359c42baff90fc9a285c3e · TTL -1 |
| OK | Value ba:v2:player:player21:matches | zset · sha256 febf5d68bd3b3a2ee47a74958ae96e9f46e82b5fc114ef3d1806b0e2bb906314 · TTL -1 | zset · sha256 febf5d68bd3b3a2ee47a74958ae96e9f46e82b5fc114ef3d1806b0e2bb906314 · TTL -1 |
| OK | Value ba:v2:player:player22 | hash · sha256 e1c4be206e5e7fda64620823721eac008e7fbea5a307b69ec22e1d7d7801f626 · TTL -1 | hash · sha256 e1c4be206e5e7fda64620823721eac008e7fbea5a307b69ec22e1d7d7801f626 · TTL -1 |
| OK | Value ba:v2:player:player22:matches | zset · sha256 febf5d68bd3b3a2ee47a74958ae96e9f46e82b5fc114ef3d1806b0e2bb906314 · TTL -1 | zset · sha256 febf5d68bd3b3a2ee47a74958ae96e9f46e82b5fc114ef3d1806b0e2bb906314 · TTL -1 |
| OK | Value ba:v2:player:player23 | hash · sha256 e3d504f1f745b3c1e9c9a84145acbed11d95a1a8b433ea4d8073eff41ae6d20c · TTL -1 | hash · sha256 e3d504f1f745b3c1e9c9a84145acbed11d95a1a8b433ea4d8073eff41ae6d20c · TTL -1 |
| OK | Value ba:v2:player:player23:matches | zset · sha256 d124390ad48bb0ee68edd55ebb9cc6d816f862152c3ac287f9fddc435b2b646e · TTL -1 | zset · sha256 d124390ad48bb0ee68edd55ebb9cc6d816f862152c3ac287f9fddc435b2b646e · TTL -1 |
| OK | Value ba:v2:player:player24 | hash · sha256 cb297d73ec2929f1fcd202e52c09246f6e7f91306d0ca3d4ebe49c1112c514ca · TTL -1 | hash · sha256 cb297d73ec2929f1fcd202e52c09246f6e7f91306d0ca3d4ebe49c1112c514ca · TTL -1 |
| OK | Value ba:v2:players | set · sha256 f3d9fe1e95ba29ebf69fc78eab361caf557b27eee961ab0c9f4d32607925a2ec · TTL -1 | set · sha256 f3d9fe1e95ba29ebf69fc78eab361caf557b27eee961ab0c9f4d32607925a2ec · TTL -1 |
| OK | Value ba:v2:season:active | string · sha256 efb555ac2ba6399a6a25f0bd371806f2df7869661b6cf4381e0060345ef8051b · TTL -1 | string · sha256 efb555ac2ba6399a6a25f0bd371806f2df7869661b6cf4381e0060345ef8051b · TTL -1 |
| OK | Value ba:v2:season:s2026_01 | hash · sha256 4198a5dfc66b98cf04c6029fdf57140b7265ecdfb658053d2e2ad92797c0b147 · TTL -1 | hash · sha256 4198a5dfc66b98cf04c6029fdf57140b7265ecdfb658053d2e2ad92797c0b147 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:leaderboard | zset · sha256 6d0c779ae4f5a6c6e861d6d951ddadda6b47a501992c4bf5ff50334727fb7ba6 · TTL -1 | zset · sha256 6d0c779ae4f5a6c6e861d6d951ddadda6b47a501992c4bf5ff50334727fb7ba6 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:matches | zset · sha256 0757afddc4391356aecc6b5cb71aa4bc5e614fed666e8dcc1b53dc82cc86ccde · TTL -1 | zset · sha256 0757afddc4391356aecc6b5cb71aa4bc5e614fed666e8dcc1b53dc82cc86ccde · TTL -1 |
| OK | Value ba:v2:season:s2026_01:participants | set · sha256 f3d9fe1e95ba29ebf69fc78eab361caf557b27eee961ab0c9f4d32607925a2ec · TTL -1 | set · sha256 f3d9fe1e95ba29ebf69fc78eab361caf557b27eee961ab0c9f4d32607925a2ec · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player01 | hash · sha256 c841dfc840d32c3660d49d749d8903696c224fa0c11b8fe4ab3af4a5ebe2c714 · TTL -1 | hash · sha256 c841dfc840d32c3660d49d749d8903696c224fa0c11b8fe4ab3af4a5ebe2c714 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player02 | hash · sha256 5132a6cb425806adaba781d6b9779c67eca888371cb84fedc2742111467179d5 · TTL -1 | hash · sha256 5132a6cb425806adaba781d6b9779c67eca888371cb84fedc2742111467179d5 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player03 | hash · sha256 1043889cd7aea53a569329e2f7feb926ebcdf263e71fe6cf07f42a3030b534d8 · TTL -1 | hash · sha256 1043889cd7aea53a569329e2f7feb926ebcdf263e71fe6cf07f42a3030b534d8 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player04 | hash · sha256 8e95d36d315593520e799502c3f69871c8dc593f4040e63a11c3ee02daba839c · TTL -1 | hash · sha256 8e95d36d315593520e799502c3f69871c8dc593f4040e63a11c3ee02daba839c · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player05 | hash · sha256 9d5bb7e6b8e5d8e210e999435f82ee1d3c11b89d4d9fc339832d88ef8b1719cb · TTL -1 | hash · sha256 9d5bb7e6b8e5d8e210e999435f82ee1d3c11b89d4d9fc339832d88ef8b1719cb · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player06 | hash · sha256 a8a0dbcf10d1dd213100e8bfb8dbedc8f4ff3bc3eb559bd127d4de35ed24d52f · TTL -1 | hash · sha256 a8a0dbcf10d1dd213100e8bfb8dbedc8f4ff3bc3eb559bd127d4de35ed24d52f · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player07 | hash · sha256 5c4d4e92955de8b381edcc6d3a495bf40d60a893aa04a3d960919c16bc7362cd · TTL -1 | hash · sha256 5c4d4e92955de8b381edcc6d3a495bf40d60a893aa04a3d960919c16bc7362cd · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player08 | hash · sha256 5a0e0a1679c315d8ab682e926ec87cdb0914f0d5d6423f4b43d4b0a4b3b135d8 · TTL -1 | hash · sha256 5a0e0a1679c315d8ab682e926ec87cdb0914f0d5d6423f4b43d4b0a4b3b135d8 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player09 | hash · sha256 669dcb2a57a960ccc15076b90b8ced0de9fce132162017ca50e4b22cc06060e2 · TTL -1 | hash · sha256 669dcb2a57a960ccc15076b90b8ced0de9fce132162017ca50e4b22cc06060e2 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player10 | hash · sha256 440d18077bde89994f6cfbcc4c6fa75638d7c3f8c7c83c4558edb1c66eb34bc4 · TTL -1 | hash · sha256 440d18077bde89994f6cfbcc4c6fa75638d7c3f8c7c83c4558edb1c66eb34bc4 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player11 | hash · sha256 f2cb22d6ea2b2464e90ba631f327f3671cecc12931497662d76ab077e973f40b · TTL -1 | hash · sha256 f2cb22d6ea2b2464e90ba631f327f3671cecc12931497662d76ab077e973f40b · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player12 | hash · sha256 b93d401cec9b2c471b2c3a4f048518611d480f8811d1c57770ed24ab029570dc · TTL -1 | hash · sha256 b93d401cec9b2c471b2c3a4f048518611d480f8811d1c57770ed24ab029570dc · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player13 | hash · sha256 129c8317c15ac9c7d38d79b2625cd8cbf9f98747a2472cc6c2570bceeb6d454c · TTL -1 | hash · sha256 129c8317c15ac9c7d38d79b2625cd8cbf9f98747a2472cc6c2570bceeb6d454c · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player14 | hash · sha256 eb8ea2aacb2b5a5b69b3d62db91565b9453c4e9d6842f2cd18457eae1a2ef45a · TTL -1 | hash · sha256 eb8ea2aacb2b5a5b69b3d62db91565b9453c4e9d6842f2cd18457eae1a2ef45a · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player15 | hash · sha256 a940f4447af5cf00ac57d722d7089dcce57ebe826749a9b9a2fb24b54432d03a · TTL -1 | hash · sha256 a940f4447af5cf00ac57d722d7089dcce57ebe826749a9b9a2fb24b54432d03a · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player16 | hash · sha256 a55997722700b2dcc9f380492b31185f8732488dc9f8d68a4607b96226b786de · TTL -1 | hash · sha256 a55997722700b2dcc9f380492b31185f8732488dc9f8d68a4607b96226b786de · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player17 | hash · sha256 b63a6c06fc12ad3c17159c79ca2ef36aceace0e4d4874eb029ade487968ff760 · TTL -1 | hash · sha256 b63a6c06fc12ad3c17159c79ca2ef36aceace0e4d4874eb029ade487968ff760 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player18 | hash · sha256 b80a6739422622af32a913a0feed5a6a22d427e68cf2001040328c05e6a8a16f · TTL -1 | hash · sha256 b80a6739422622af32a913a0feed5a6a22d427e68cf2001040328c05e6a8a16f · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player19 | hash · sha256 c9a615b452fae2fad7ec93edc36b9d300b1b9267160b0f754627bcba84b1ccd3 · TTL -1 | hash · sha256 c9a615b452fae2fad7ec93edc36b9d300b1b9267160b0f754627bcba84b1ccd3 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player20 | hash · sha256 3e9d766383930a5fba29cae6cffed67e4eba28c92b46127bfd20d2eeb3561820 · TTL -1 | hash · sha256 3e9d766383930a5fba29cae6cffed67e4eba28c92b46127bfd20d2eeb3561820 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player21 | hash · sha256 cb0f3a643e441a9b620b70c9f44221da948693d923751a9b1c2c5d03c49485e0 · TTL -1 | hash · sha256 cb0f3a643e441a9b620b70c9f44221da948693d923751a9b1c2c5d03c49485e0 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player22 | hash · sha256 1ae754bb0f6a862851c65ee61b62df8e58a74cad6e9c952a57232182f595fc01 · TTL -1 | hash · sha256 1ae754bb0f6a862851c65ee61b62df8e58a74cad6e9c952a57232182f595fc01 · TTL -1 |
| OK | Value ba:v2:season:s2026_01:stats:player23 | hash · sha256 9525f91f95fb6911d7f03e06b9d8d52e4a8d6020378e06d3e07c9c0567b90682 · TTL -1 | hash · sha256 9525f91f95fb6911d7f03e06b9d8d52e4a8d6020378e06d3e07c9c0567b90682 · TTL -1 |
| OK | Value ba:v2:season:s2026_02 | hash · sha256 623499a5595c8f0901da0caaf9069688f97cf53f5c633cadce2520d54bc435f2 · TTL -1 | hash · sha256 623499a5595c8f0901da0caaf9069688f97cf53f5c633cadce2520d54bc435f2 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:leaderboard | zset · sha256 8242a4661b08df45ae99dfc5c417f17fe87698532d2165d6dcfd987787f17d14 · TTL -1 | zset · sha256 8242a4661b08df45ae99dfc5c417f17fe87698532d2165d6dcfd987787f17d14 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:matches | zset · sha256 cf17bc6095cd48201dd69a01f1515de10be27e9e19cb7ec069a5d3c2629a7770 · TTL -1 | zset · sha256 cf17bc6095cd48201dd69a01f1515de10be27e9e19cb7ec069a5d3c2629a7770 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:participants | set · sha256 8b594f2e36aa6420d4e6337a18ca47579060de17595d1b7b1254f19e82326e1e · TTL -1 | set · sha256 8b594f2e36aa6420d4e6337a18ca47579060de17595d1b7b1254f19e82326e1e · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player01 | hash · sha256 c019cb442c5b010219628515ec5a33e65d9e71ba060124d400604dabac3dd097 · TTL -1 | hash · sha256 c019cb442c5b010219628515ec5a33e65d9e71ba060124d400604dabac3dd097 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player02 | hash · sha256 9feb6ffa8e3bbf4d8718628ee98eab8940138463c485af8a6f76cd3c9c54f286 · TTL -1 | hash · sha256 9feb6ffa8e3bbf4d8718628ee98eab8940138463c485af8a6f76cd3c9c54f286 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player03 | hash · sha256 8401f97a0337cb8333c5e0b6862e4aabcb437cbc41f86e0d02cd0b7d6c2a8a91 · TTL -1 | hash · sha256 8401f97a0337cb8333c5e0b6862e4aabcb437cbc41f86e0d02cd0b7d6c2a8a91 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player04 | hash · sha256 d97fc742687fb05ca1328502d6135f8014740f1b8757430101814b2f8a926a5e · TTL -1 | hash · sha256 d97fc742687fb05ca1328502d6135f8014740f1b8757430101814b2f8a926a5e · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player05 | hash · sha256 5b5b25bc1b49b93e18048bfd8ae1e36e94a512cb1b95ec531a3c8cb60a59867d · TTL -1 | hash · sha256 5b5b25bc1b49b93e18048bfd8ae1e36e94a512cb1b95ec531a3c8cb60a59867d · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player06 | hash · sha256 93098626a20d093110874cc7f9ac67fa3825a09b494af81ce5227c0ec630939f · TTL -1 | hash · sha256 93098626a20d093110874cc7f9ac67fa3825a09b494af81ce5227c0ec630939f · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player07 | hash · sha256 30e4a02590f66cc46fa0676a1756b282db579e7f76c143b8234402066a7b5d1a · TTL -1 | hash · sha256 30e4a02590f66cc46fa0676a1756b282db579e7f76c143b8234402066a7b5d1a · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player08 | hash · sha256 1d372ccf4a4ee97884cb7cd17b0cc2a1f8e4607de9ba129b70fbb4bbdf71079c · TTL -1 | hash · sha256 1d372ccf4a4ee97884cb7cd17b0cc2a1f8e4607de9ba129b70fbb4bbdf71079c · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player09 | hash · sha256 fcdad900f69b95f65ecc9445dc6c06b2d3771b75922dfebac0d3b0b95d5a0f57 · TTL -1 | hash · sha256 fcdad900f69b95f65ecc9445dc6c06b2d3771b75922dfebac0d3b0b95d5a0f57 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player10 | hash · sha256 16b16bba840620348efca3e4b15808b09af64bf6ae3f187238e7a1695f6afbfc · TTL -1 | hash · sha256 16b16bba840620348efca3e4b15808b09af64bf6ae3f187238e7a1695f6afbfc · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player11 | hash · sha256 0d1d961bc14d18c2e7b6297d04e5d155bd5d1560a626791db95f9539abfc814e · TTL -1 | hash · sha256 0d1d961bc14d18c2e7b6297d04e5d155bd5d1560a626791db95f9539abfc814e · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player12 | hash · sha256 bc36fbee2f51474acba58d6d6d26652ff0513a1b17ad3db41592b06c7a23edf4 · TTL -1 | hash · sha256 bc36fbee2f51474acba58d6d6d26652ff0513a1b17ad3db41592b06c7a23edf4 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player13 | hash · sha256 0d21701cb0a1598ecec4661c2c0379c74a355c46a6506eabcf5910ecf0f302c3 · TTL -1 | hash · sha256 0d21701cb0a1598ecec4661c2c0379c74a355c46a6506eabcf5910ecf0f302c3 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player14 | hash · sha256 721b97dc8f18c744db1a7c65dda7c9fa86ba1dae04f22c6e07d4250bb180f566 · TTL -1 | hash · sha256 721b97dc8f18c744db1a7c65dda7c9fa86ba1dae04f22c6e07d4250bb180f566 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player15 | hash · sha256 ed3863f6f00264e1460231b565216be20f2dda285bbc6071278d0e471adab026 · TTL -1 | hash · sha256 ed3863f6f00264e1460231b565216be20f2dda285bbc6071278d0e471adab026 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player16 | hash · sha256 e4d7a251a77c013bb21c9c8f646af533fa9363444102f5318402277c34a482af · TTL -1 | hash · sha256 e4d7a251a77c013bb21c9c8f646af533fa9363444102f5318402277c34a482af · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player17 | hash · sha256 ca0680cfcba6dc82e06ffd1e916c3c5a52bfe8d3f454f143f79d84510f7466c3 · TTL -1 | hash · sha256 ca0680cfcba6dc82e06ffd1e916c3c5a52bfe8d3f454f143f79d84510f7466c3 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player18 | hash · sha256 f2e9b4b9f733f909f293d2f4a5665c8954702e540d555719f812f145c675e17e · TTL -1 | hash · sha256 f2e9b4b9f733f909f293d2f4a5665c8954702e540d555719f812f145c675e17e · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player19 | hash · sha256 94caec574b5a2fd3670026aa78de3e2f2e34533e95ecc7b6bfb31b136b7411de · TTL -1 | hash · sha256 94caec574b5a2fd3670026aa78de3e2f2e34533e95ecc7b6bfb31b136b7411de · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player20 | hash · sha256 ef4c30e2ddb50bd909e2891a3ceeb339b94bb4cafe3cc1d33ca6639e3dd6472d · TTL -1 | hash · sha256 ef4c30e2ddb50bd909e2891a3ceeb339b94bb4cafe3cc1d33ca6639e3dd6472d · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player21 | hash · sha256 c0230cb121a9318a9aafcb369cc2114a83d3c15c1e84c11507973315677314b9 · TTL -1 | hash · sha256 c0230cb121a9318a9aafcb369cc2114a83d3c15c1e84c11507973315677314b9 · TTL -1 |
| OK | Value ba:v2:season:s2026_02:stats:player22 | hash · sha256 b739dab35bd4ff451f835b4edc975711a9d2e078100ac4a59dd6d19ec90fa1d8 · TTL -1 | hash · sha256 b739dab35bd4ff451f835b4edc975711a9d2e078100ac4a59dd6d19ec90fa1d8 · TTL -1 |
| OK | Value ba:v2:seasons | set · sha256 9065c2938174dcfa22e84088c332c219aa494a6b7d740271f7aeb595cbbf7da3 · TTL -1 | set · sha256 9065c2938174dcfa22e84088c332c219aa494a6b7d740271f7aeb595cbbf7da3 · TTL -1 |
| OK | Value ba:v2:seed:version | string · sha256 4cf88f683a4da1cfe175677915668d64e74f5eb4a546b3401faa15afa67da457 · TTL -1 | string · sha256 4cf88f683a4da1cfe175677915668d64e74f5eb4a546b3401faa15afa67da457 · TTL -1 |
| FAIL | FT.SEARCH active players | ba:v2:player:player05 ba:v2:player:player06 ba:v2:player:player07 ba:v2:player:player11 ba:v2:player:player12 ba:v2:player:player13 ba:v2:player:player15 ba:v2:player:player16 ba:v2:player:player17 ba:v2:player:player22 | ba:v2:player:player05 ba:v2:player:player06 ba:v2:player:player08 ba:v2:player:player12 ba:v2:player:player13 ba:v2:player:player14 ba:v2:player:player16 ba:v2:player:player21 ba:v2:player:player22 ba:v2:player:player24 |
