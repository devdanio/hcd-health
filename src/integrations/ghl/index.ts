// Define the interface for the contact response
export interface SearchResponse {
  contacts: Contact[]
  total: number
}

export interface Contact {
  id: string
  phoneLabel: string
  country: string
  address: string
  source: string
  type: string
  locationId: string
  dnd: boolean
  state: string
  businessName: string
  customFields: CustomField[]
  tags: string[]
  dateAdded: string
  additionalEmails: string[]
  phone: string
  companyName: string
  additionalPhones: string[]
  dateUpdated: string
  city: string
  dateOfBirth: string
  firstNameLowerCase: string
  lastNameLowerCase: string
  email: string
  assignedTo: string
  followers: string[]
  validEmail: boolean
  dndSettings: DndSettings
  opportunities: Opportunity[]
  postalCode: string
  businessId: string
  searchAfter: [number, string]
}

export interface CustomField {
  id: string
  value: string
}

export interface DndSettings {
  Call: Call
  Email: Email
  SMS: Sms
  WhatsApp: WhatsApp
  GMB: Gmb
  FB: Fb
}

export interface Call {
  status: string
  message: string
  code: string
}

export interface Email {
  status: string
  message: string
  code: string
}

export interface Sms {
  status: string
  message: string
  code: string
}

export interface WhatsApp {
  status: string
  message: string
  code: string
}

export interface Gmb {
  status: string
  message: string
  code: string
}

export interface Fb {
  status: string
  message: string
  code: string
}

export interface Opportunity {
  id: string
  pipeline_id: string
  pipeline_stage_id: string
  monetary_value: number
  status: string
}
interface AttributionSource {
  sessionSource: string
  medium: string
  mediumId: string | null
}

interface CustomField {
  id: string
  value: string | number
}

export interface Contact {
  id: string
  dateAdded: string
  dateUpdated: string
  tags: string[]
  type: string
  locationId: string
  firstName: string
  firstNameLowerCase: string
  fullNameLowerCase: string
  lastName: string
  lastNameLowerCase: string
  email: string
  emailLowerCase: string
  phone: string
  attributionSource: AttributionSource
  customFields: CustomField[]
  additionalEmails: string[]
  additionalPhones: string[]
  mindbodyID: string
}

// Update the return type of the function
export const getContactByID = async (
  id: string,
): Promise<Contact | undefined> => {
  const url = `https://services.leadconnectorhq.com/contacts/${id}`
  const options = {
    method: 'GET',
    headers: {
      Authorization: 'Bearer pit-497bb882-db3c-4077-9b19-55bd83ab98fa',
      Version: '2021-07-28',
      Accept: 'application/json',
    },
  }

  try {
    const response = await fetch(url, options)
    const data = await response.json()
    console.log('data', data)
    return data
    // const mindbodyID = data.contact.customFields.find(
    //   (field) => field.id === "geGHNYbbzsc1auUc7v1S"
    // )?.value;
    // return {
    //   ...data.contact,
    //   mindbodyID,
    // };
  } catch (error) {
    console.error(error)
    return undefined // Return undefined in case of an error
  }
}

export const searchForClientByEmail = async (email: string) => {
  const url = 'https://services.leadconnectorhq.com/contacts/search'
  const options = {
    method: 'POST',
    headers: {
      Authorization: 'Bearer pit-497bb882-db3c-4077-9b19-55bd83ab98fa',
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: `{"locationId":"wJVrTbSAivxHv8BabSZZ","page":1,"pageLimit":20,"filters":[{"field":"email","operator":"eq","value":"${email}"}]}`,
  }

  try {
    const response = await fetch(url, options)
    const data = (await response.json()) as SearchResponse
    return data.contacts?.[0]
  } catch (error) {
    logger.error(error)
  }
  return null
}

export const getPaginatedContacts = async (page: number, pageLimit: number) => {
  const url = 'https://services.leadconnectorhq.com/contacts/'
  const options = {
    method: 'POST',
    headers: {
      Authorization: 'Bearer pit-497bb882-db3c-4077-9b19-55bd83ab98fa',
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: `{"locationId":"wJVrTbSAivxHv8BabSZZ","page":${page},"pageLimit":${pageLimit}}`,
  }

  try {
    const response = await fetch(url, options)
    console.log('response', response)
    const data = (await response.json()) as SearchResponse
    return data.contacts?.[0]
  } catch (error) {
    console.error(error)
  }
  return null
}
