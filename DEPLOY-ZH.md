# AFTERDATE 部署步骤

1. 在 GitHub 新建空仓库 `afterdate`，不要额外创建 README、License 或 `.gitignore`。
2. 上传本项目解压后的全部内容。
3. 在 Vercel 导入仓库，Root Directory 选择 `frontend`，Framework 选择 Vite。
4. 完成第一次预览部署；未配置合约地址时会显示示例账本。
5. 在 Remix 新建 `Afterdate.sol`，复制 `contracts/src/Afterdate.sol` 的全部内容。
6. 使用 Solidity `0.8.24` 编译，切换到 BOT Chain（Chain ID 677）并部署；构造函数没有参数。
7. 复制部署后的合约地址，在 Vercel 添加 Config 环境变量：

```text
VITE_AFTERDATE_ADDRESS=0x你的完整合约地址
```

8. 环境选择 Production，保存后重新部署，建议不要使用旧 Build Cache。

合约地址是公开信息，不要设为 Secret。绝对不要上传钱包私钥。项目未经专业审计，正式使用前请完成安全审计。
