import { BigInt, log } from "@graphprotocol/graph-ts"
import { AuctionBid, AuctionEnded } from "../generated/AuctionHouse/AuctionHouse"
import { ZoraBid } from "../generated/schema"
import { ZORA_AUCTION_HOUSE_ADDRESS } from "./constants"
import { _createSaleEntityFromParams } from "./shared"

export function handleZoraBidCreated(event: AuctionBid): void {
    let auctionId = event.params.auctionId.toString()
    log.debug(`running handleZoraBidCreated for ${auctionId}`, [])

    let currentHighestBid = ZoraBid.load(_bidIdFromAuctionId(auctionId))

    // if this is first bid for auction, create new bid entity
    if (!currentHighestBid) {
        let bid = new ZoraBid(_bidIdFromAuctionId(auctionId))
        bid.amount = event.params.value
        bid.bidder = event.params.sender
        bid.save()
        return
    }

    // otherwise, set bid as active bid
    // if this event got emitted, this bid is the highest/active one
    currentHighestBid.amount = event.params.value
    currentHighestBid.bidder = event.params.sender
    currentHighestBid.save()
}

export function handleZoraAuctionEnded(event: AuctionEnded): void {
    let auctionId = event.params.auctionId.toString()
    let buyer = event.params.winner
    let seller = event.params.tokenOwner
    let paymentToken = event.params.auctionCurrency
    let nftContractAddress = event.params.tokenContract
    let nftTokenId = event.params.tokenId.toString()

    // get price of sale from active bid entity, falling back to slightly incorrect event.params.amount if no bid was found (this should never happen though)
    let price: BigInt
    let activeBid = ZoraBid.load(_bidIdFromAuctionId(auctionId))
    if (!activeBid) {
        price = event.params.amount
    } else {
        price = activeBid.amount
    }

    let saleId = event.transaction.hash.toHexString()
    _createSaleEntityFromParams(saleId, "Single", ZORA_AUCTION_HOUSE_ADDRESS, event.block, buyer, seller, paymentToken, price, nftContractAddress, nftTokenId)
}

function _bidIdFromAuctionId(auctionId: string): string {
    return `${auctionId}-active-bid`
}