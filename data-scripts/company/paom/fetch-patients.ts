import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as cheerio from 'cheerio'
const connectionString = `${process.env.DATABASE_URL}`
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// Constants
const COMPANY_ID = 'cmijjrb0j0000i2apq31ubh28'

const extractPatients = async () => {
  const response = await fetch(
    'https://ehr.unifiedpractice.com/Public/PatientManagement/PatientListFragment?PractitionerId=&PageCount=10001&PageIndex=0&PartialName=&IncludeArchived=false&_=1764722253706',
    {
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'en-US,en;q=0.9',
        newrelic:
          'eyJ2IjpbMCwxXSwiZCI6eyJ0eSI6IkJyb3dzZXIiLCJhYyI6IjY2MjY0NjQiLCJhcCI6IjYwMTU1NDIxNyIsImlkIjoiODQzNjA2NDY1MTY2ODIzOSIsInRyIjoiYmQ3OGViMjFlOGU5OTk4MzRhNThmZTJjOTgyNmYzMDgiLCJ0aSI6MTc2NDcyMjMzMDU0OCwidGsiOiI0NzcyNDM4In19',
        priority: 'u=1, i',
        'sec-ch-ua': '"Not_A Brand";v="99", "Chromium";v="142"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        traceparent: '00-bd78eb21e8e999834a58fe2c9826f308-8436064651668239-01',
        tracestate:
          '4772438@nr=0-1-6626464-601554217-8436064651668239----1764722330548',
        'x-newrelic-id': 'UgAFV1JVDBAFUlBSAAQHU1M=',
        'x-requested-with': 'XMLHttpRequest',
        cookie:
          '__RequestVerificationToken_L1B1YmxpYw2=0WZp-zc_etazTa8eGD74WAhHrVytQzypJkCjRqJQIcm6SNpdNbEdlfQW4rEMgCLyp_4c3HdqZPv_QWXJacIbiPVht7tymLQ4f37ly5njQOo1; __stripe_mid=a82827da-f8e6-42ad-aa85-fa45d471d50ff228c5; ASP.NET_SessionId=mqc45jc2je4rccchwqfvmuho; __cf_bm=KzQ1xthT2Ih0_aFAtWzioGKX4Du6JBgpYPrtJy0b91s-1764721849-1.0.1.1-lI4Ck59USjddDZsbeJ4f6Fhm9AfmlVnm2zJ_v9MYG0zTyRV3X8LU9uglRQ.xUTaiJhIWtbQX3psXvkR7FAMg1oVZb83vwodZsU38m405o4E; cf_clearance=90VHrY7iZ6YME7c6phQRSOGRHPYD6Zw.BsPvKEg8KVs-1764721851-1.2.1.1-0ZH9AYGjEOPNPGtNXps1yiiSRuFD0wnpu.jQzymb8YuEBCgHw1aztr2QeKHcvjqCFC7LkbQoyBrij0aDyKzT7NmJgp4nIFiMvCO1_.s3wSruJfq4wCTJv3L3jkPRgJ3Qv2kfnf4tIUJpVNKl2UEioHpKcCOESHtlQCoQi2TfR8ohVpxO6QV5jxz6kkid_aqb5GTCXC97_duyLvy2ep6QCPPReIiiSjAtQB_.MZTKXs8; chatToken=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzdGV2ZUBwYS1vbS5jb20iLCJhdWQiOiI1OTY1NDg3IiwibGFzdF9uYW1lIjoiSG9mZm1hbiIsImV4cCI6MTc2NDc2NTA1NiwiaWF0IjoxNzY0NzIxODU2LCJmaXJzdF9uYW1lIjoiU3RldmVuIn0._AqDuD417vac-vbuYxSVeB0nS_JxH6Wz7vRKWL-g6yk; sessionid=SLhSQpT/z0COSAUq+zAXRDtCTwq0HygLaps04Yij0W7g3uAwrGOFPszHc+zsXF6D8sKqekTg7NVAVuIF8wR9+KGmxYpNGNF2i5z7fS95jTKSDHLZ660dFcBiB14yka2R; cmtSettings={"IsSidebarCollapsed":"false"}',
        Referer:
          'https://ehr.unifiedpractice.com/Public/PatientManagement/ClinicPatients',
      },
      body: null,
      method: 'GET',
    },
  )
  const json = await response.json()
  return json.Content.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>')
}

const transformPatients = async () => {
  const patients = await extractPatients()
  const $ = cheerio.load(patients)
  const results: { id: string; name: string }[] = []
  $('a.js-patient.item-patient').each((i, el) => {
    const id = $(el).attr('data-id')
    const name = $(el).find('h3').text().trim()

    if (!id || !name) {
      console.warn('Skipping patient', id, name)
      return
    }
    results.push({ id, name })
  })

  console.log(results)
  return results
}

const loadPatients = async () => {
  const patients = await transformPatients()
  for (const patient of patients) {
    await prisma.patient.upsert({
      where: {
        externalId: patient.id,
      },
      update: {
        contact: {
          update: {
            fullName: patient.name,
          },
        },
      },
      create: {
        externalId: patient.id,
        contact: {
          create: {
            fullName: patient.name,
            companyId: COMPANY_ID,
          },
        },
      },
    })
  }
}

await loadPatients()
