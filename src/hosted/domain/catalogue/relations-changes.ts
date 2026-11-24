// Only operations and inputs declared in Exact's reference are included.
import type { CatalogMutation } from "./shape.js";

export const relationsChanges = {
  exact_accounts_create: { entity: "accounts", method: "POST",
    fields: {
      ID: "guid", Accountant: "guid", AccountManager: "guid", ActivitySector: "guid", ActivitySubSector: "guid",
      AddressLine1: "text", AddressLine2: "text", AddressLine3: "text", AutomaticProcessProposedEntry: "int",
      Blocked: "boolean", BSN: "text", BusinessType: "guid", CanDropShip: "boolean", ChamberOfCommerce: "text",
      City: "text", Classification1: "guid", Classification2: "guid", Classification3: "guid", Classification4:
      "guid", Classification5: "guid", Classification6: "guid", Classification7: "guid", Classification8: "guid",
      ClientGroup: "guid", Code: "text", CodeAtSupplier: "text", CompanySize: "guid", ConsolidationScenario: "int",
      ControlledDate: "date", Country: "text", CreditLinePurchase: "number", CreditLineSales: "number",
      DatevCreditorCode: "text", DatevDebtorCode: "text", DeliveryAdvice: "int", DiscountPurchase: "number",
      DiscountSales: "number", Email: "text", EnableSalesPaymentLink: "boolean", EndDate: "date", EORINumber:
      "text", EstablishedDate: "date", Fax: "text", GLAccountPurchase: "guid", GLAccountSales: "guid", GLAP: "guid",
      GLAR: "guid", GlnNumber: "text", HasWithholdingTaxSales: "boolean", IgnoreDatevWarningMessage: "boolean",
      IncotermAddressPurchase: "text", IncotermAddressSales: "text", IncotermCodePurchase: "text",
      IncotermCodeSales: "text", IncotermVersionPurchase: "int", IncotermVersionSales: "int", IntraStatArea: "text",
      IntraStatDeliveryTerm: "text", IntraStatSystem: "text", IntraStatTransactionA: "text", IntraStatTransactionB:
      "text", IntraStatTransportMethod: "text", InvoiceAccount: "guid", InvoiceAttachmentType: "int",
      InvoicingMethod: "int", IsAccountant: "int", IsAgency: "int", IsCompetitor: "int", IsExtraDuty: "boolean",
      IsMailing: "int", IsPilot: "boolean", IsReseller: "boolean", IsSupplier: "boolean", Language: "text",
      Latitude: "number", LeadPurpose: "guid", LeadSource: "guid", Logo: "binary", LogoFileName: "text", Longitude:
      "number", MainContact: "guid", Name: "text", OINNumber: "text", Parent: "guid", PayAsYouEarn: "text",
      PaymentConditionPurchase: "text", PaymentConditionSales: "text", PeppolIdentifier: "text",
      PeppolIdentifierType: "int", Phone: "text", PhoneExtension: "text", Postcode: "text", PriceList: "guid",
      PurchaseCurrency: "text", PurchaseLeadDays: "int", PurchaseVATCode: "text", RecepientOfCommissions: "boolean",
      Remarks: "text", Reseller: "guid", RSIN: "text", SalesCurrency: "text", SalesTaxSchedule: "guid",
      SalesVATCode: "text", SearchCode: "text", SecurityLevel: "int", SeparateInvPerSubscription: "int",
      ShippingLeadDays: "int", ShippingMethod: "guid", ShowRemarkForSales: "boolean", StartDate: "date", State:
      "text", Status: "text", TradeName: "text", UniqueTaxpayerReference: "text", VATLiability: "text", VATNumber:
      "text", Website: "text" },
    required: ["Name"],
  },
  exact_accounts_update: { entity: "accounts", method: "PUT",
    fields: {
      Accountant: "guid", AccountManager: "guid", ActivitySector: "guid", ActivitySubSector: "guid", AddressLine1:
      "text", AddressLine2: "text", AddressLine3: "text", AutomaticProcessProposedEntry: "int", Blocked: "boolean",
      BSN: "text", BusinessType: "guid", CanDropShip: "boolean", ChamberOfCommerce: "text", City: "text",
      Classification1: "guid", Classification2: "guid", Classification3: "guid", Classification4: "guid",
      Classification5: "guid", Classification6: "guid", Classification7: "guid", Classification8: "guid",
      ClientGroup: "guid", Code: "text", CodeAtSupplier: "text", CompanySize: "guid", ConsolidationScenario: "int",
      ControlledDate: "date", Country: "text", CreditLinePurchase: "number", CreditLineSales: "number",
      DatevCreditorCode: "text", DatevDebtorCode: "text", DeliveryAdvice: "int", DiscountPurchase: "number",
      DiscountSales: "number", Email: "text", EnableSalesPaymentLink: "boolean", EndDate: "date", EORINumber:
      "text", EstablishedDate: "date", Fax: "text", GLAccountPurchase: "guid", GLAccountSales: "guid", GLAP: "guid",
      GLAR: "guid", GlnNumber: "text", HasWithholdingTaxSales: "boolean", IgnoreDatevWarningMessage: "boolean",
      IncotermAddressPurchase: "text", IncotermAddressSales: "text", IncotermCodePurchase: "text",
      IncotermCodeSales: "text", IncotermVersionPurchase: "int", IncotermVersionSales: "int", IntraStatArea: "text",
      IntraStatDeliveryTerm: "text", IntraStatSystem: "text", IntraStatTransactionA: "text", IntraStatTransactionB:
      "text", IntraStatTransportMethod: "text", InvoiceAccount: "guid", InvoiceAttachmentType: "int",
      InvoicingMethod: "int", IsAccountant: "int", IsAgency: "int", IsCompetitor: "int", IsExtraDuty: "boolean",
      IsMailing: "int", IsPilot: "boolean", IsReseller: "boolean", IsSupplier: "boolean", Language: "text",
      Latitude: "number", LeadPurpose: "guid", LeadSource: "guid", Logo: "binary", LogoFileName: "text", Longitude:
      "number", MainContact: "guid", Name: "text", OINNumber: "text", Parent: "guid", PayAsYouEarn: "text",
      PaymentConditionPurchase: "text", PaymentConditionSales: "text", PeppolIdentifier: "text",
      PeppolIdentifierType: "int", Phone: "text", PhoneExtension: "text", Postcode: "text", PriceList: "guid",
      PurchaseCurrency: "text", PurchaseLeadDays: "int", PurchaseVATCode: "text", RecepientOfCommissions: "boolean",
      Remarks: "text", Reseller: "guid", RSIN: "text", SalesCurrency: "text", SalesTaxSchedule: "guid",
      SalesVATCode: "text", SearchCode: "text", SecurityLevel: "int", SeparateInvPerSubscription: "int",
      ShippingLeadDays: "int", ShippingMethod: "guid", ShowRemarkForSales: "boolean", StartDate: "date", State:
      "text", Status: "text", TradeName: "text", UniqueTaxpayerReference: "text", VATLiability: "text", VATNumber:
      "text", Website: "text" },
    required: [],
  },
  exact_contacts_create: { entity: "contacts", method: "POST",
    fields: {
      ID: "guid", Account: "guid", BirthDate: "date", BirthName: "text", BirthNamePrefix: "text", BirthPlace:
      "text", BusinessEmail: "text", BusinessFax: "text", BusinessMobile: "text", BusinessPhone: "text",
      BusinessPhoneExtension: "text", Email: "text", EndDate: "date", FirstName: "text", Gender: "text", HID: "int",
      IdentificationDate: "date", IdentificationDocument: "guid", IdentificationUser: "guid", Initials: "text",
      IsMailingExcluded: "boolean", JobTitleDescription: "text", Language: "text", LastName: "text", LeadPurpose:
      "guid", LeadSource: "guid", MarketingNotes: "text", MiddleName: "text", Mobile: "text", Nationality: "text",
      Notes: "text", Person: "guid", Phone: "text", Picture: "binary", PictureName: "text", SocialSecurityNumber:
      "text", StartDate: "date", Title: "text" },
    required: ["Account", "FirstName", "LastName"],
  },
  exact_contacts_update: { entity: "contacts", method: "PUT",
    fields: {
      BirthDate: "date", BirthName: "text", BirthNamePrefix: "text", BirthPlace: "text", BusinessEmail: "text",
      BusinessFax: "text", BusinessMobile: "text", BusinessPhone: "text", BusinessPhoneExtension: "text", Email:
      "text", EndDate: "date", FirstName: "text", Gender: "text", HID: "int", IdentificationDate: "date",
      IdentificationDocument: "guid", IdentificationUser: "guid", Initials: "text", IsMailingExcluded: "boolean",
      JobTitleDescription: "text", Language: "text", LastName: "text", LeadPurpose: "guid", LeadSource: "guid",
      MarketingNotes: "text", MiddleName: "text", Mobile: "text", Nationality: "text", Notes: "text", Person:
      "guid", Phone: "text", Picture: "binary", PictureName: "text", SocialSecurityNumber: "text", StartDate:
      "date", Title: "text" },
    required: [],
  },
  exact_addresses_create: { entity: "addresses", method: "POST",
    fields: {
      ID: "guid", Account: "guid", AddressLine1: "text", AddressLine2: "text", AddressLine3: "text", City: "text",
      Contact: "guid", Country: "text", Fax: "text", FreeBoolField_01: "boolean", FreeBoolField_02: "boolean",
      FreeBoolField_03: "boolean", FreeBoolField_04: "boolean", FreeBoolField_05: "boolean", FreeDateField_01:
      "date", FreeDateField_02: "date", FreeDateField_03: "date", FreeDateField_04: "date", FreeDateField_05:
      "date", FreeNumberField_01: "number", FreeNumberField_02: "number", FreeNumberField_03: "number",
      FreeNumberField_04: "number", FreeNumberField_05: "number", FreeTextField_01: "text", FreeTextField_02:
      "text", FreeTextField_03: "text", FreeTextField_04: "text", FreeTextField_05: "text", Mailbox: "text", Main:
      "boolean", NicNumber: "text", Notes: "text", Phone: "text", PhoneExtension: "text", Postcode: "text", State:
      "text", Type: "int", Warehouse: "guid" },
    required: [],
  },
  exact_addresses_update: { entity: "addresses", method: "PUT",
    fields: {
      Account: "guid", AddressLine1: "text", AddressLine2: "text", AddressLine3: "text", City: "text", Contact:
      "guid", Country: "text", Fax: "text", FreeBoolField_01: "boolean", FreeBoolField_02: "boolean",
      FreeBoolField_03: "boolean", FreeBoolField_04: "boolean", FreeBoolField_05: "boolean", FreeDateField_01:
      "date", FreeDateField_02: "date", FreeDateField_03: "date", FreeDateField_04: "date", FreeDateField_05:
      "date", FreeNumberField_01: "number", FreeNumberField_02: "number", FreeNumberField_03: "number",
      FreeNumberField_04: "number", FreeNumberField_05: "number", FreeTextField_01: "text", FreeTextField_02:
      "text", FreeTextField_03: "text", FreeTextField_04: "text", FreeTextField_05: "text", Mailbox: "text", Main:
      "boolean", NicNumber: "text", Notes: "text", Phone: "text", PhoneExtension: "text", Postcode: "text", State:
      "text", Type: "int", Warehouse: "guid" },
    required: [],
  },
  exact_bank_accounts_create: { entity: "bank_accounts", method: "POST",
    fields: {
      ID: "guid", Account: "guid", BankAccount: "text", BankAccountHolderName: "text", BICCode: "text", Blocked:
      "boolean", Description: "text", Main: "boolean" },
    required: ["Account", "BankAccount"],
  },
  exact_bank_accounts_update: { entity: "bank_accounts", method: "PUT",
    fields: {
      Account: "guid", BankAccount: "text", BankAccountHolderName: "text", BICCode: "text", Blocked: "boolean",
      Description: "text", Main: "boolean" },
    required: [],
  },
} satisfies Record<string, CatalogMutation>;
