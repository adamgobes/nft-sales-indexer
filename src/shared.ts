import { ethereum, BigInt, Bytes, Address } from "@graphprotocol/graph-ts";
import { Sale } from "../generated/schema";

export function _createSaleEntityFromParams(
    saleId: string,
    saleType: string,
    exchange: string,
    block: ethereum.Block,
    buyer: Bytes,
    seller: Bytes,
    paymentToken: Bytes,
    price: BigInt,
    nftContractAddress: Bytes,
    nftTokenId: string
): void {
    let sale = new Sale(saleId);

    sale.saleType = saleType;
    sale.exchange = Address.fromString(exchange)
    sale.blockNumber = block.number;
    sale.timestamp = block.timestamp.toI32();
    sale.buyer = buyer;
    sale.seller = seller;
    sale.paymentToken = paymentToken;
    sale.price = price;
    sale.nftContractAddress = nftContractAddress;
    sale.nftTokenId = nftTokenId
    sale.save();
}