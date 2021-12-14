# `nft-sales-indexer` 🖼️

_Subgraph for querying NFT sales. Currently indexes the [Opensea Wyvern Exchange contract](https://etherscan.io/address/0x7be8076f4ea4a4ad08075c2508e481d6c946d12b) and the [Zora AuctionHouse contract](https://etherscan.io/address/0xE468cE99444174Bd3bBBEd09209577d25D1ad673)_

## Contributing
Want to add more NFT exchanges? Add the relevant handler config in `subgraph.yml`, and the corresponding mapping code in `src/[your_exchange].ts` and submit a PR!