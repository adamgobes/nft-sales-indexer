import { BigInt } from "@graphprotocol/graph-ts"
import { AuctionBid, AuctionEnded } from "../generated/AuctionHouse/AuctionHouse"
import { ZoraBid } from "../generated/schema"
import { ZORA_AUCTION_HOUSE_ADDRESS } from "./constants"
import { _createSaleEntityFromParams } from "./shared"

export function handleZoraBidCreated(event: AuctionBid): void {
    let activeBid = new ZoraBid(event.params.auctionId.toString())

    activeBid.amount = event.params.value
    activeBid.bidder = event.params.sender
    activeBid.save()
}

export function handleZoraAuctionEnded(event: AuctionEnded): void {
    // get price of sale from active bid entity, falling back to slightly incorrect event.params.amount if no bid was found (this should never happen though)
    let price: BigInt
    let activeBid = ZoraBid.load(event.params.auctionId.toString())
    if (!activeBid) {
        price = event.params.amount
    } else {
        price = activeBid.amount
    }

    let saleId = event.transaction.hash.toHexString()
    _createSaleEntityFromParams(
        saleId,
        "Single",
        ZORA_AUCTION_HOUSE_ADDRESS,
        event.block,
        event.params.winner,
        event.params.tokenOwner,
        event.params.auctionCurrency,
        price,
        event.params.tokenContract,
        event.params.tokenId.toString()
    )
}
