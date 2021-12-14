import { AuctionEnded } from "../generated/AuctionHouse/AuctionHouse"
import { ZORA_AUCTION_HOUSE_ADDRESS } from "./constants"
import { _createSaleEntityFromParams } from "./shared"

export function handleZoraAuctionEnded_(event: AuctionEnded): void {
    let saleId = event.transaction.hash.toHexString()
    let buyer = event.params.winner
    let seller = event.params.tokenOwner
    let paymentToken = event.params.auctionCurrency
    let price = event.params.amount
    let nftContractAddress = event.params.tokenContract
    let nftTokenId = event.params.tokenId.toString()

    _createSaleEntityFromParams(saleId, "Single", ZORA_AUCTION_HOUSE_ADDRESS, event.block, buyer, seller, paymentToken, price, nftContractAddress, nftTokenId)
}