# ごみ収集日APIからごみ収集日を取得してCSVを作成する
# ごみ収集日API: https://api.odp.jig.jp/rubbish/lgcodes
#
# ruby scripts/create_garbage_days_csv.rb
#
# 全然登録されていなかった

require 'net/http'
require 'json'
require 'csv'
#require 'pry-byebug'

class GarbageDaysClient
  # エンドポイント
  AREA_ENDPOINT = 'https://api.odp.jig.jp/rubbish/areas'
  GARBAGE_DAYS_ENDPOINT = 'https://api.odp.jig.jp/rubbish/collection_days'

  # CSVファイル名
  LGCODE_AREAS_FILENAME = "csvs/lgcode_areas.csv"
  GARBAGE_DAYS_FILENAME = "csvs/garbage_days.csv"
  INVALID_LGCODES_FILENAME = "csvs/invalid_lgcodes.csv"

  attr_accessor :requested_invalid_lgcodes

  def initialize
    @requested_invalid_lgcodes = []
  end

  def create_areas_csv
    return if File.exists?(LGCODE_AREAS_FILENAME)
    areas_responses = get_areas_responses
    write_areas_csv(areas_responses)
    write_invalid_lgcodes_filename
  end

  def create_garbage_dsys_csv
    fail NotImplementedError
    return if File.exists?(GARBAGE_DAYS_FILENAME)
    responses = get_garbage_days_responses
    write_garbage_days_csv(responses)
  end

  private

  def get_areas_responses
    lgcodes.map do |lgcode|
      puts("lgcode: #{lgcode}")
      request_areas(lgcode).tap do |res|
        # 無効なコードとは保存しておきあとからCSVに出力できるようにしておく
        requested_invalid_lgcodes.push(lgcode) unless res
      end
    end.compact
  end

  def request_areas(lgcode)
    uri = URI.parse("#{AREA_ENDPOINT}?lgcode=#{lgcode}")
    begin
      res = Net::HTTP.get(uri)
      res = JSON.parse(res)
      if res['success'] && res['result'] && !res['result'].empty?
        res
      else
        nil
      end
    rescue => ex
      puts ex.message
      nil
    end
  end

  def get_garbage_days_responses
    fail NotImplementedError
  end

  def write_areas_csv(areas_responses)
    CSV.open(LGCODE_AREAS_FILENAME, 'w') do |csv|
      csv << ['lgcode', 'area_ja', 'area_en'] # header
      areas_responses.each do |res|
        lgcode = res['params']['lgcode']
        res['result'].each do |r|
          csv << [lgcode, r['ja'], r['en']]
        end
      end
    end
  end

  def write_invalid_lgcodes_filename
    CSV.open(INVALID_LGCODES_FILENAME, 'w') do |csv|
      csv << ['invalid_lgcodes'] # header
      requested_invalid_lgcodes.each do |lgcode|
        csv << [lgcode]
      end
    end
  end

  def write_garbage_days_csv(responses); end

  def lgcodes
    all_lgcodes - saved_invalid_lgcodes
  end

  # lgcodes(全国地方公共団体)
  # https://ja.wikipedia.org/wiki/%E5%85%A8%E5%9B%BD%E5%9C%B0%E6%96%B9%E5%85%AC%E5%85%B1%E5%9B%A3%E4%BD%93%E3%82%B3%E3%83%BC%E3%83%89
  # 機械的なコードなのでinvalidなコードも入っている。invalidはリクエストしてエラーレスポンスの場合エラーと判断
  def all_lgcodes
    @all_lgcodes ||= (01..47).map do |pref_code|
      (100..799).map do |city_code|
        format('%02d%d', pref_code, city_code)
      end
    end.flatten
  end

  def saved_invalid_lgcodes
    @saved_invalid_lgcodes ||=
      if File.exists?(INVALID_LGCODES_FILENAME)
        CSV.table(INVALID_LGCODES_FILENAME)[:invalid_lgcodes]
      else
        []
      end
  end
end

# エリア一覧を作成する
GarbageDaysClient.new.create_areas_csv

# エリア一覧からごみ収集日一覧を作成する
# GarbageDaysClient.new.create_garbage_dsys_csv
